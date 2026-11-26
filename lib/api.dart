import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'models.dart';

/// URL del backend en Render. Para probar con un servidor local: flutter run --dart-define=API_URL=http://TU_IP:3000
const baseUrl = String.fromEnvironment('API_URL', defaultValue: 'https://rentatek-api.onrender.com');

class ApiException implements Exception {
  final String message;
  final int status;
  ApiException(this.message, this.status);
}

/// Ejecuta una acción y muestra el error de la API en un SnackBar.
Future<void> guard(BuildContext c, Future<void> Function() f) async {
  try {
    await f();
  } on ApiException catch (e) {
    if (c.mounted) ScaffoldMessenger.of(c).showSnackBar(SnackBar(content: Text(e.message)));
  }
}

class Api {
  static String? token;

  static Future<dynamic> _call(String method, String path, [Object? body]) async {
    final req = http.Request(method, Uri.parse('$baseUrl$path'))
      ..headers['Content-Type'] = 'application/json';
    if (token != null) req.headers['Authorization'] = 'Bearer $token';
    if (body != null) req.body = jsonEncode(body);
    http.Response res;
    try {
      // 75 s: el plan gratis de Render tarda en "despertar" tras estar inactivo.
      res = await http.Response.fromStream(await req.send().timeout(const Duration(seconds: 75)));
    } catch (_) {
      throw ApiException('No se pudo conectar con el servidor', 0);
    }
    final data = res.body.isEmpty ? null : jsonDecode(res.body);
    if (res.statusCode >= 400) {
      throw ApiException('${data is Map ? data['error'] ?? 'Error ${res.statusCode}' : 'Error ${res.statusCode}'}', res.statusCode);
    }
    return data;
  }

  static Future<User> _session(dynamic d) async {
    token = d['token'] as String;
    final p = await SharedPreferences.getInstance();
    await p.setString('token', token!);
    await p.setString('user', jsonEncode(d['user']));
    return User.fromJson(d['user']);
  }

  static Future<User> login(String email, String pass) async =>
      _session(await _call('POST', '/auth/login', {'email': email, 'password': pass}));
  static Future<User> register(Map<String, dynamic> b) async =>
      _session(await _call('POST', '/auth/register', b));

  static Future<User?> restore() async {
    final p = await SharedPreferences.getInstance();
    token = p.getString('token');
    final u = p.getString('user');
    return (token == null || u == null) ? null : User.fromJson(jsonDecode(u));
  }

  static Future<void> logout() async {
    token = null;
    final p = await SharedPreferences.getInstance();
    await p.remove('token');
    await p.remove('user');
  }

  static Future<List<Machine>> machines() async =>
      [for (final j in (await _call('GET', '/maquinaria')) as List) Machine.fromJson(j)];
  static Future<List<Request>> requests() async =>
      [for (final j in (await _call('GET', '/solicitudes')) as List) Request.fromJson(j)];
  static Future<void> createMachine(Map<String, dynamic> b) => _call('POST', '/maquinaria', b);
  static Future<void> setStatus(int id, Status s) => _call('PATCH', '/maquinaria/$id/estado', {'estado': s.api});
  static Future<void> createRequest(Map<String, dynamic> b) => _call('POST', '/solicitudes', b);
  static Future<void> setRequestStatus(int id, String estado) => _call('PATCH', '/solicitudes/$id/estado', {'estado': estado});
}
