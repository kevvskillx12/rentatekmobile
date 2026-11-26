import 'package:flutter/material.dart';
import 'theme.dart';
import 'models.dart';
import 'client.dart';
import 'api.dart';

class ProviderShell extends StatefulWidget {
  const ProviderShell({super.key});
  @override
  State<ProviderShell> createState() => _ProviderShellState();
}

class _ProviderShellState extends State<ProviderShell> {
  int i = 0;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: app,
        builder: (_, __) => Scaffold(
          appBar: AppBar(
            title: Text(['Mis equipos', 'Solicitudes recibidas'][i]),
            actions: [
              IconButton(tooltip: 'Cerrar sesión', icon: const Icon(Icons.logout), onPressed: app.logout),
            ],
          ),
          body: i == 0 ? const MyMachines() : const RequestsScreen(forProvider: true),
          floatingActionButton: i == 0
              ? FloatingActionButton.extended(
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PublishScreen())),
                  icon: const Icon(Icons.add),
                  label: const Text('Publicar', style: TextStyle(fontWeight: FontWeight.w800)))
              : null,
          bottomNavigationBar: NavigationBar(
            selectedIndex: i,
            onDestinationSelected: (v) => setState(() => i = v),
            destinations: const [
              NavigationDestination(icon: Icon(Icons.construction), label: 'Mis equipos'),
              NavigationDestination(icon: Icon(Icons.mail_outline), label: 'Solicitudes'),
            ],
          ),
        ),
      );
}

class MyMachines extends StatelessWidget {
  const MyMachines({super.key});

  Widget _stat(String label, String value, Color c) => Expanded(
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(value, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: c)),
              Text(label, style: const TextStyle(fontSize: 12, color: RT.dark)),
            ]),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final mine = app.machines.where((m) => m.providerId == app.user!.id).toList();
    final avail = mine.where((m) => m.status == Status.disponible).length;
    final reqs = app.requests.where((r) => r.status == 'pendiente').length;
    return RefreshIndicator(onRefresh: app.refresh, color: RT.graphite, child: ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.fromLTRB(16, 16, 16, 90), children: [
      Row(children: [
        _stat('Publicados', '${mine.length}', RT.graphite),
        const SizedBox(width: 10),
        _stat('Disponibles', '$avail', RT.green),
        const SizedBox(width: 10),
        _stat('Pendientes', '$reqs', RT.orange),
      ]),
      const SizedBox(height: 16),
      for (final m in mine) ...[
        MachineCard(m,
            trailing: PopupMenuButton<Status>(
              tooltip: 'Cambiar estado',
              icon: const Icon(Icons.more_vert),
              onSelected: (s) => guard(context, () => app.setStatus(m, s)),
              itemBuilder: (_) => [for (final s in Status.values) PopupMenuItem(value: s, child: Text(s.label))],
            )),
        const SizedBox(height: 12),
      ],
    ]));
  }
}

class PublishScreen extends StatefulWidget {
  const PublishScreen({super.key});
  @override
  State<PublishScreen> createState() => _PublishScreenState();
}

class _PublishScreenState extends State<PublishScreen> {
  final key = GlobalKey<FormState>();
  final name = TextEditingController(), city = TextEditingController(text: 'Mérida, Yuc.');
  final price = TextEditingController(), cap = TextEditingController(), desc = TextEditingController();
  String cat = categories.first;
  Status status = Status.disponible;
  String? req(String? v) => (v == null || v.trim().isEmpty) ? 'Campo obligatorio' : null;

  bool busy = false;

  Future<void> _save() async {
    if (!key.currentState!.validate()) return;
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    setState(() => busy = true);
    try {
      await app.addMachine({
        'nombre': name.text.trim(),
        'categoria': cat,
        'ciudad': city.text.trim(),
        'precio_dia': double.tryParse(price.text) ?? 0,
        'descripcion': desc.text.trim(),
        'estado': status.api,
        'specs': {if (cap.text.trim().isNotEmpty) 'Capacidad / potencia': cap.text.trim()},
      });
      nav.pop();
      messenger.showSnackBar(const SnackBar(content: Text('Equipo publicado en el catálogo')));
    } on ApiException catch (e) {
      if (mounted) setState(() => busy = false);
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Publicar maquinaria')),
        body: Form(
          key: key,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            TextFormField(controller: name, validator: req, decoration: const InputDecoration(labelText: 'Nombre del equipo')),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
                initialValue: cat,
                decoration: const InputDecoration(labelText: 'Categoría'),
                items: [for (final c in categories) DropdownMenuItem(value: c, child: Text(c))],
                onChanged: (v) => setState(() => cat = v!)),
            const SizedBox(height: 12),
            TextFormField(controller: price, validator: req, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Precio por día (MXN)', prefixText: '\$ ')),
            const SizedBox(height: 12),
            TextFormField(controller: city, validator: req, decoration: const InputDecoration(labelText: 'Ubicación')),
            const SizedBox(height: 12),
            TextFormField(controller: cap, decoration: const InputDecoration(labelText: 'Capacidad / potencia (opcional)')),
            const SizedBox(height: 12),
            TextFormField(controller: desc, maxLines: 3, decoration: const InputDecoration(labelText: 'Descripción')),
            const SizedBox(height: 12),
            DropdownButtonFormField<Status>(
                initialValue: status,
                decoration: const InputDecoration(labelText: 'Disponibilidad'),
                items: [for (final s in Status.values) DropdownMenuItem(value: s, child: Text(s.label))],
                onChanged: (v) => setState(() => status = v!)),
            const SizedBox(height: 20),
            FilledButton(onPressed: busy ? null : _save, child: Text(busy ? 'PUBLICANDO…' : 'PUBLICAR EQUIPO')),
          ]),
        ),
      );
}
