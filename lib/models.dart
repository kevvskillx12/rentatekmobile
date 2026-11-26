import 'package:flutter/material.dart';
import 'api.dart';
import 'theme.dart';

enum Status { disponible, porLiberar, rentada }

extension StatusX on Status {
  String get label => switch (this) {
        Status.disponible => 'Disponible',
        Status.porLiberar => 'Por liberar',
        Status.rentada => 'Rentada',
      };
  Color get color => switch (this) {
        Status.disponible => RT.green,
        Status.porLiberar => RT.orange,
        Status.rentada => RT.red,
      };
  /// Valor que usa la API / PostgreSQL.
  String get api => switch (this) {
        Status.disponible => 'disponible',
        Status.porLiberar => 'por_liberar',
        Status.rentada => 'rentada',
      };
}

Status statusFrom(String s) =>
    Status.values.firstWhere((e) => e.api == s, orElse: () => Status.disponible);

const categories = ['Excavación', 'Carga', 'Compactación', 'Concreto', 'Elevación'];
const categoryIcons = {
  'Excavación': Icons.construction,
  'Carga': Icons.local_shipping,
  'Compactación': Icons.layers,
  'Concreto': Icons.water_drop,
  'Elevación': Icons.height,
};

class User {
  final int id;
  final String name, email, role;
  User.fromJson(Map<String, dynamic> j)
      : id = j['id'] as int,
        name = j['nombre'] as String,
        email = j['email'] as String,
        role = j['rol'] as String;
}

class Machine {
  final int id, providerId;
  final String name, category, provider, city, description;
  final double price;
  final Map<String, String> specs;
  Status status;

  Machine.fromJson(Map<String, dynamic> j)
      : id = j['id'] as int,
        providerId = j['proveedor_id'] as int,
        name = j['nombre'] as String,
        category = j['categoria'] as String,
        provider = j['proveedor'] as String,
        city = j['ciudad'] as String,
        description = (j['descripcion'] ?? '') as String,
        price = double.parse('${j['precio_dia']}'),
        specs = {for (final e in ((j['specs'] ?? {}) as Map).entries) '${e.key}': '${e.value}'},
        status = statusFrom(j['estado'] as String);

  IconData get icon => categoryIcons[category] ?? Icons.construction;

  @override
  bool operator ==(Object other) => other is Machine && other.id == id;
  @override
  int get hashCode => id;
}

class Request {
  final int id, days;
  final String machine, provider, client, phone, message, status;
  Request.fromJson(Map<String, dynamic> j)
      : id = j['id'] as int,
        machine = j['maquina'] as String,
        provider = j['proveedor'] as String,
        client = j['nombre_contacto'] as String,
        phone = j['telefono'] as String,
        message = (j['mensaje'] ?? '') as String,
        status = (j['estado'] ?? 'pendiente') as String,
        days = (j['dias'] ?? 1) as int;
}

/// Estado global: ahora los datos vienen del backend (PostgreSQL vía API).
class AppState extends ChangeNotifier {
  User? user;
  String? error;
  List<Machine> machines = [];
  List<Request> requests = [];
  final compare = <Machine>[];

  bool get isProvider => user?.role == 'proveedor';

  Future<void> restore() async {
    user = await Api.restore();
    notifyListeners();
    if (user != null) await refresh();
  }

  Future<void> login(String email, String pass) async {
    user = await Api.login(email, pass);
    notifyListeners();
    await refresh();
  }

  Future<void> register(Map<String, dynamic> body) async {
    user = await Api.register(body);
    notifyListeners();
    await refresh();
  }

  Future<void> logout() async {
    await Api.logout();
    user = null;
    machines = [];
    requests = [];
    compare.clear();
    notifyListeners();
  }

  Future<void> refresh() async {
    try {
      machines = await Api.machines();
      if (user != null) requests = await Api.requests();
      final ids = compare.map((m) => m.id).toSet();
      compare
        ..clear()
        ..addAll(machines.where((m) => ids.contains(m.id)));
      error = null;
    } on ApiException catch (e) {
      if (e.status == 401) return logout();
      error = e.message;
    }
    notifyListeners();
  }

  void toggleCompare(Machine m) {
    if (!compare.remove(m) && compare.length < 3) compare.add(m);
    notifyListeners();
  }

  void clearCompare() {
    compare.clear();
    notifyListeners();
  }

  Future<void> addMachine(Map<String, dynamic> body) async {
    await Api.createMachine(body);
    await refresh();
  }

  Future<void> setStatus(Machine m, Status s) async {
    await Api.setStatus(m.id, s);
    m.status = s;
    notifyListeners();
  }

  Future<void> addRequest(Map<String, dynamic> body) async {
    await Api.createRequest(body);
    await refresh();
  }

  Future<void> answerRequest(Request r, String estado) async {
    await Api.setRequestStatus(r.id, estado);
    await refresh();
  }
}

final app = AppState();
