import 'package:flutter/material.dart';
import 'theme.dart';
import 'api.dart';
import 'models.dart';
import 'client.dart';
import 'provider_side.dart';

void main() => runApp(const RentatekApp());

class RentatekApp extends StatelessWidget {
  const RentatekApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
      title: 'Rentatek',
      debugShowCheckedModeBanner: false,
      theme: RT.theme(),
      home: const Gate());
}

/// Decide qué mostrar: login, panel de cliente o panel de proveedor.
class Gate extends StatefulWidget {
  const Gate({super.key});
  @override
  State<Gate> createState() => _GateState();
}

class _GateState extends State<Gate> {
  bool ready = false;
  @override
  void initState() {
    super.initState();
    app.restore().whenComplete(() => setState(() => ready = true));
  }

  @override
  Widget build(BuildContext context) {
    if (!ready) {
      return Scaffold(
          backgroundColor: RT.graphite,
          body: Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
                width: 88, height: 88,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: RT.white, borderRadius: BorderRadius.circular(22)),
                child: Image.asset('assets/images/rentatek_icon.png')),
            const SizedBox(height: 24),
            const CircularProgressIndicator(color: RT.yellow),
          ])));
    }
    return ListenableBuilder(
      listenable: app,
      builder: (_, __) => app.user == null
          ? const AuthScreen()
          : app.isProvider
              ? const ProviderShell()
              : const ClientShell(),
    );
  }
}

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final key = GlobalKey<FormState>();
  final name = TextEditingController(), email = TextEditingController();
  final pass = TextEditingController(), company = TextEditingController();
  bool register = false, busy = false;
  String role = 'cliente';
  String? error;

  String? req(String? v) => (v == null || v.trim().isEmpty) ? 'Campo obligatorio' : null;

  Future<void> _submit() async {
    if (!key.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (register) {
        await app.register({
          'nombre': name.text.trim(),
          'email': email.text.trim(),
          'password': pass.text,
          'rol': role,
          if (role == 'proveedor' && company.text.trim().isNotEmpty) 'empresa': company.text.trim(),
        });
      } else {
        await app.login(email.text.trim(), pass.text);
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    }
    if (mounted) setState(() => busy = false);
  }

  Widget _role(String value, String label, IconData icon) => Expanded(
        child: ChoiceChip(
          label: SizedBox(width: double.infinity, child: Text(label, textAlign: TextAlign.center)),
          avatar: Icon(icon, size: 18, color: role == value ? RT.graphite : Colors.white),
          selected: role == value,
          onSelected: (_) => setState(() => role = value),
          selectedColor: RT.yellow,
          backgroundColor: RT.dark,
          side: BorderSide.none,
          showCheckmark: false,
          labelStyle: TextStyle(color: role == value ? RT.graphite : Colors.white, fontWeight: FontWeight.w800),
        ),
      );

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: RT.graphite,
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: key,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const SizedBox(height: 24),
                Container(
                    width: 72, height: 72,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: RT.white, borderRadius: BorderRadius.circular(18)),
                    child: Image.asset('assets/images/rentatek_icon.png')),
                const SizedBox(height: 20),
                const Text('RENTATEK',
                    style: TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w900, letterSpacing: 2)),
                const SizedBox(height: 6),
                Text(register ? 'Crea tu cuenta' : 'Inicia sesión para continuar',
                    style: const TextStyle(color: Colors.white70, fontSize: 15)),
                const SizedBox(height: 28),
                if (register) ...[
                  Row(children: [
                    _role('cliente', 'Cliente', Icons.search),
                    const SizedBox(width: 10),
                    _role('proveedor', 'Proveedor', Icons.local_shipping),
                  ]),
                  const SizedBox(height: 12),
                  TextFormField(controller: name, validator: req, decoration: const InputDecoration(labelText: 'Nombre completo')),
                  const SizedBox(height: 12),
                  if (role == 'proveedor') ...[
                    TextFormField(controller: company, decoration: const InputDecoration(labelText: 'Empresa (opcional)')),
                    const SizedBox(height: 12),
                  ],
                ],
                TextFormField(controller: email, validator: req, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Correo electrónico')),
                const SizedBox(height: 12),
                TextFormField(
                    controller: pass, obscureText: true,
                    validator: (v) => (v == null || v.length < 6) ? 'Mínimo 6 caracteres' : null,
                    decoration: const InputDecoration(labelText: 'Contraseña')),
                if (error != null) ...[
                  const SizedBox(height: 12),
                  Text(error!, style: const TextStyle(color: RT.red, fontWeight: FontWeight.w700)),
                ],
                const SizedBox(height: 20),
                FilledButton(
                    onPressed: busy ? null : _submit,
                    child: busy
                        ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: RT.graphite))
                        : Text(register ? 'CREAR CUENTA' : 'ENTRAR')),
                const SizedBox(height: 8),
                Center(
                  child: TextButton(
                    onPressed: () => setState(() {
                      register = !register;
                      error = null;
                    }),
                    child: Text(register ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate',
                        style: const TextStyle(color: RT.yellow, fontWeight: FontWeight.w700)),
                  ),
                ),
              ]),
            ),
          ),
        ),
      );
}
