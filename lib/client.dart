import 'package:flutter/material.dart';
import 'theme.dart';
import 'models.dart';
import 'package:url_launcher/url_launcher.dart';
import 'api.dart';

class ClientShell extends StatefulWidget {
  const ClientShell({super.key});
  @override
  State<ClientShell> createState() => _ClientShellState();
}

class _ClientShellState extends State<ClientShell> {
  int i = 0;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: app,
        builder: (_, __) => Scaffold(
          appBar: AppBar(
            title: Text(['Catálogo', 'Comparar', 'Mis solicitudes'][i]),
            actions: [
              IconButton(tooltip: 'Cerrar sesión', icon: const Icon(Icons.logout), onPressed: app.logout),
            ],
          ),
          body: [const CatalogScreen(), const CompareScreen(), const RequestsScreen(forProvider: false)][i],
          bottomNavigationBar: NavigationBar(
            selectedIndex: i,
            onDestinationSelected: (v) => setState(() => i = v),
            destinations: [
              const NavigationDestination(icon: Icon(Icons.search), label: 'Catálogo'),
              NavigationDestination(
                  icon: Badge(
                      label: Text('${app.compare.length}'),
                      isLabelVisible: app.compare.isNotEmpty,
                      child: const Icon(Icons.compare_arrows)),
                  label: 'Comparar'),
              const NavigationDestination(icon: Icon(Icons.mail_outline), label: 'Solicitudes'),
            ],
          ),
        ),
      );
}

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key});
  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  String q = '', cat = 'Todas';
  bool onlyAvail = false;

  Widget _chip(String label, bool sel, VoidCallback onTap) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: ChoiceChip(
          label: Text(label),
          selected: sel,
          onSelected: (_) => onTap(),
          selectedColor: RT.yellow,
          backgroundColor: RT.dark,
          side: BorderSide.none,
          showCheckmark: false,
          labelStyle: TextStyle(color: sel ? RT.graphite : Colors.white, fontWeight: FontWeight.w700),
        ),
      );

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: app,
        builder: (_, __) {
          final list = app.machines.where((m) {
            final text = '${m.name} ${m.provider} ${m.category}'.toLowerCase();
            return (cat == 'Todas' || m.category == cat) &&
                (!onlyAvail || m.status == Status.disponible) &&
                text.contains(q.toLowerCase());
          }).toList();
          return Column(children: [
            Container(
              color: RT.graphite,
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
              child: Column(children: [
                TextField(
                    onChanged: (v) => setState(() => q = v),
                    decoration: const InputDecoration(
                        hintText: 'Buscar excavadora, proveedor…', prefixIcon: Icon(Icons.search))),
                const SizedBox(height: 10),
                SizedBox(
                  height: 40,
                  child: ListView(scrollDirection: Axis.horizontal, children: [
                    _chip('Solo disponibles', onlyAvail, () => setState(() => onlyAvail = !onlyAvail)),
                    for (final c in ['Todas', ...categories]) _chip(c, cat == c, () => setState(() => cat = c)),
                  ]),
                ),
              ]),
            ),
            Expanded(
              child: RefreshIndicator(
                color: RT.graphite,
                onRefresh: app.refresh,
                child: list.isEmpty
                    ? ListView(children: [
                        const SizedBox(height: 80),
                        app.error != null
                            ? EmptyState(Icons.cloud_off, 'Sin conexión', app.error!)
                            : const EmptyState(Icons.search_off, 'Sin resultados', 'Prueba con otra búsqueda o categoría.'),
                      ])
                    : ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.all(16),
                        itemCount: list.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (_, k) => MachineCard(list[k],
                            onTap: () => Navigator.of(context)
                                .push(MaterialPageRoute(builder: (_) => DetailScreen(list[k])))),
                      ),
              ),
            ),
          ]);
        },
      );
}

Widget section(String title, Widget child) => Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title.toUpperCase(),
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.1, color: RT.dark)),
            const SizedBox(height: 10),
            child,
          ]),
        ),
      ),
    );

class DetailScreen extends StatelessWidget {
  final Machine m;
  const DetailScreen(this.m, {super.key});

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: app,
        builder: (ctx, _) {
          final inCompare = app.compare.contains(m);
          return Scaffold(
            appBar: AppBar(title: const Text('Detalle del equipo')),
            body: ListView(padding: const EdgeInsets.all(16), children: [
              Container(
                  height: 150,
                  decoration: BoxDecoration(color: RT.graphite, borderRadius: BorderRadius.circular(20)),
                  child: Center(child: Icon(m.icon, size: 84, color: RT.yellow))),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(child: Text(m.name, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900))),
                Pill(m.status.label, m.status.color),
              ]),
              const SizedBox(height: 6),
              Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(money(m.price), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900)),
                const Text('  por día', style: TextStyle(color: RT.dark)),
              ]),
              section('Descripción', Text(m.description, style: const TextStyle(height: 1.4))),
              section(
                  'Especificaciones',
                  Column(children: [
                    for (final e in m.specs.entries)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(children: [
                          Expanded(child: Text(e.key, style: const TextStyle(color: RT.dark))),
                          Text(e.value, style: const TextStyle(fontWeight: FontWeight.w800)),
                        ]),
                      ),
                  ])),
              section(
                  'Proveedor',
                  Row(children: [
                    const CircleAvatar(backgroundColor: RT.graphite, child: Icon(Icons.business, color: RT.yellow)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(m.provider, style: const TextStyle(fontWeight: FontWeight.w800)),
                      Text(m.city, style: const TextStyle(color: RT.dark, fontSize: 13)),
                    ])),
                  ])),
            ]),
            bottomNavigationBar: Container(
              color: RT.white,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: SafeArea(
                top: false,
                child: Row(children: [
                  Expanded(
                      child: OutlinedButton.icon(
                          onPressed: () => app.toggleCompare(m),
                          icon: Icon(inCompare ? Icons.check : Icons.compare_arrows),
                          label: Text(inCompare ? 'En comparación' : 'Comparar'))),
                  const SizedBox(width: 12),
                  Expanded(
                      flex: 2,
                      child: FilledButton.icon(
                          onPressed: m.status == Status.rentada
                              ? null
                              : () => showModalBottomSheet(
                                  context: ctx,
                                  isScrollControlled: true,
                                  showDragHandle: true,
                                  backgroundColor: RT.light,
                                  builder: (_) => ContactForm(m)),
                          icon: const Icon(Icons.send),
                          label: const Text('CONTACTAR'))),
                ]),
              ),
            ),
          );
        },
      );
}

class ContactForm extends StatefulWidget {
  final Machine m;
  const ContactForm(this.m, {super.key});
  @override
  State<ContactForm> createState() => _ContactFormState();
}

class _ContactFormState extends State<ContactForm> {
  final key = GlobalKey<FormState>();
  final name = TextEditingController(), phone = TextEditingController();
  final days = TextEditingController(text: '1'), msg = TextEditingController();
  String? req(String? v) => (v == null || v.trim().isEmpty) ? 'Campo obligatorio' : null;
  bool busy = false;

  @override
  void dispose() {
    for (final c in [name, phone, days, msg]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _send() async {
    if (!key.currentState!.validate()) return;
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    setState(() => busy = true);
    try {
      await app.addRequest({
        'maquina_id': widget.m.id,
        'nombre_contacto': name.text.trim(),
        'telefono': phone.text.trim(),
        'dias': int.tryParse(days.text) ?? 1,
        'mensaje': msg.text.trim(),
      });
      nav.pop();
      messenger.showSnackBar(const SnackBar(content: Text('Solicitud enviada al proveedor')));
    } on ApiException catch (e) {
      if (mounted) setState(() => busy = false);
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(context).viewInsets.bottom + 20),
        child: SingleChildScrollView(
          child: Form(
            key: key,
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Contactar a ${widget.m.provider}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
              Text(widget.m.name, style: const TextStyle(color: RT.dark)),
              const SizedBox(height: 16),
              TextFormField(controller: name, validator: req, decoration: const InputDecoration(labelText: 'Tu nombre o empresa')),
              const SizedBox(height: 12),
              TextFormField(controller: phone, validator: req, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Teléfono')),
              const SizedBox(height: 12),
              TextFormField(controller: days, validator: req, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Días de renta')),
              const SizedBox(height: 12),
              TextFormField(controller: msg, maxLines: 3, decoration: const InputDecoration(labelText: 'Mensaje (opcional)')),
              const SizedBox(height: 16),
              FilledButton(onPressed: busy ? null : _send, child: Text(busy ? 'ENVIANDO…' : 'ENVIAR SOLICITUD')),
            ]),
          ),
        ),
      );
}

class CompareScreen extends StatelessWidget {
  const CompareScreen({super.key});
  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: app,
        builder: (_, __) {
          final items = app.compare;
          if (items.isEmpty) {
            return const EmptyState(Icons.compare_arrows, 'Nada para comparar',
                'Abre un equipo y toca "Comparar" (máximo 3).');
          }
          final rows = <String, String Function(Machine)>{
            'Precio / día': (m) => money(m.price),
            'Estado': (m) => m.status.label,
            'Proveedor': (m) => m.provider,
            'Ciudad': (m) => m.city,
          };
          for (final k in {for (final m in items) ...m.specs.keys}) {
            rows[k] = (m) => m.specs[k] ?? '—';
          }
          return ListView(padding: const EdgeInsets.all(16), children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Table(
                  columnWidths: const {0: FixedColumnWidth(92)},
                  defaultVerticalAlignment: TableCellVerticalAlignment.middle,
                  children: [
                    TableRow(children: [
                      const SizedBox.shrink(),
                      for (final m in items)
                        Padding(
                          padding: const EdgeInsets.all(8),
                          child: Column(children: [
                            Icon(m.icon, color: RT.graphite),
                            const SizedBox(height: 4),
                            Text(m.name, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                          ]),
                        ),
                    ]),
                    for (final e in rows.entries)
                      TableRow(
                        decoration: const BoxDecoration(border: Border(top: BorderSide(color: RT.line))),
                        children: [
                          Padding(padding: const EdgeInsets.all(8), child: Text(e.key, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: RT.dark))),
                          for (final m in items)
                            Padding(padding: const EdgeInsets.all(8), child: Text(e.value(m), textAlign: TextAlign.center, style: const TextStyle(fontSize: 13))),
                        ],
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(onPressed: app.clearCompare, icon: const Icon(Icons.delete_outline), label: const Text('Limpiar comparación')),
          ]);
        },
      );
}

/// Abre un chat de WhatsApp con el cliente (asume México +52 si el número tiene 10 dígitos).
Future<void> openWhatsApp(BuildContext ctx, Request r) async {
  final messenger = ScaffoldMessenger.of(ctx);
  var d = r.phone.replaceAll(RegExp(r'\D'), '');
  if (d.length == 10) d = '52$d';
  if (d.length == 13 && d.startsWith('521')) d = '52${d.substring(3)}';
  final text = 'Hola ${r.client}, te escribe ${r.provider} desde Rentatek sobre tu solicitud de renta de '
      '${r.machine} (${r.days} ${r.days == 1 ? 'día' : 'días'}).';
  final uri = Uri.parse('https://wa.me/$d?text=${Uri.encodeComponent(text)}');
  var ok = false;
  try {
    ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {}
  if (!ok) messenger.showSnackBar(const SnackBar(content: Text('No se pudo abrir WhatsApp')));
}

Pill reqPill(String s) => switch (s) {
      'aceptada' => const Pill('Aceptada', RT.green),
      'rechazada' => const Pill('Rechazada', RT.red),
      _ => const Pill('Pendiente', RT.orange),
    };

class RequestsScreen extends StatelessWidget {
  final bool forProvider;
  const RequestsScreen({super.key, required this.forProvider});
  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: app,
        builder: (_, __) {
          // el servidor ya filtra según el rol; las pendientes van primero
          final all = app.requests;
          final list = [...all.where((r) => r.status == 'pendiente'), ...all.where((r) => r.status != 'pendiente')];
          return RefreshIndicator(
            color: RT.graphite,
            onRefresh: app.refresh,
            child: list.isEmpty
                ? ListView(children: [
                    const SizedBox(height: 80),
                    EmptyState(Icons.mail_outline, 'Sin solicitudes',
                        forProvider ? 'Aquí llegarán los contactos de tus clientes.' : 'Cuando contactes a un proveedor, verás tus solicitudes aquí.'),
                  ])
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    itemCount: list.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (ctx, k) {
                      final r = list[k];
                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [
                              Expanded(child: Text(r.machine, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
                              reqPill(r.status),
                            ]),
                            const SizedBox(height: 6),
                            Text(forProvider ? '${r.client} · ${r.phone}' : r.provider, style: const TextStyle(color: RT.dark)),
                            Text('${r.days} ${r.days == 1 ? 'día' : 'días'} de renta', style: const TextStyle(color: RT.dark, fontSize: 13)),
                            if (r.message.isNotEmpty) ...[const SizedBox(height: 8), Text(r.message)],
                            if (!forProvider && r.status == 'aceptada') ...[
                              const SizedBox(height: 8),
                              const Text('El proveedor aceptó tu solicitud y se pondrá en contacto contigo.',
                                  style: TextStyle(color: RT.green, fontWeight: FontWeight.w700, fontSize: 13)),
                            ],
                            if (forProvider && r.status == 'pendiente') ...[
                              const SizedBox(height: 12),
                              Row(children: [
                                Expanded(
                                    child: OutlinedButton(
                                        style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(42)),
                                        onPressed: () => guard(ctx, () => app.answerRequest(r, 'rechazada')),
                                        child: const Text('Rechazar'))),
                                const SizedBox(width: 10),
                                Expanded(
                                    child: FilledButton(
                                        style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(42)),
                                        onPressed: () {
                                          final msg = ScaffoldMessenger.of(ctx);
                                          guard(ctx, () async {
                                            await app.answerRequest(r, 'aceptada');
                                            msg.showSnackBar(const SnackBar(
                                                content: Text('Solicitud aceptada. El equipo quedó como Rentada.')));
                                          });
                                        },
                                        child: const Text('ACEPTAR'))),
                              ]),
                            ],
                            if (forProvider && r.status != 'rechazada') ...[
                              const SizedBox(height: 10),
                              OutlinedButton.icon(
                                  style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(42)),
                                  onPressed: () => openWhatsApp(ctx, r),
                                  icon: const Icon(Icons.chat, color: RT.green),
                                  label: const Text('Contactar por WhatsApp')),
                            ],
                          ]),
                        ),
                      );
                    },
                  ),
          );
        },
      );
}
