import 'package:flutter/material.dart';
import 'models.dart';

/// Paleta oficial de Rentatek + ThemeData.
class RT {
  static const yellow = Color(0xFFF5B800); // primario: acciones
  static const graphite = Color(0xFF20252B); // primario: navegación/encabezados
  static const dark = Color(0xFF343B43);
  static const light = Color(0xFFF4F5F7); // fondo general
  static const white = Color(0xFFFFFFFF);
  static const green = Color(0xFF249B62); // disponible
  static const red = Color(0xFFE54848); // error / alerta
  static const orange = Color(0xFFE99A24); // advertencia
  static const line = Color(0xFFE3E5E9);

  static ThemeData theme() {
    final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(12));
    const h = Size.fromHeight(50);
    const btnText = TextStyle(fontWeight: FontWeight.w800, fontSize: 15);
    OutlineInputBorder border(Color c, double w) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: w == 0 ? BorderSide.none : BorderSide(color: c, width: w));
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: yellow).copyWith(
          primary: yellow, onPrimary: graphite, secondary: graphite,
          onSecondary: white, surface: white, onSurface: graphite, error: red),
      scaffoldBackgroundColor: light,
      appBarTheme: const AppBarTheme(
          backgroundColor: graphite, foregroundColor: white, elevation: 0,
          scrolledUnderElevation: 0,
          titleTextStyle: TextStyle(color: white, fontSize: 19, fontWeight: FontWeight.w800)),
      filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
              backgroundColor: yellow, foregroundColor: graphite,
              disabledBackgroundColor: line, minimumSize: h, shape: shape, textStyle: btnText)),
      outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
              foregroundColor: graphite, minimumSize: h, shape: shape, textStyle: btnText,
              side: const BorderSide(color: graphite, width: 1.5))),
      inputDecorationTheme: InputDecorationTheme(
          filled: true, fillColor: white,
          border: border(white, 0), focusedBorder: border(yellow, 2)),
      navigationBarTheme: NavigationBarThemeData(
          backgroundColor: graphite, indicatorColor: yellow,
          iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(
              color: s.contains(WidgetState.selected) ? graphite : Colors.white70)),
          labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(
              fontSize: 12, fontWeight: FontWeight.w700,
              color: s.contains(WidgetState.selected) ? yellow : Colors.white70))),
      cardTheme: CardThemeData(
          color: white, elevation: 0, margin: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: line))),
      snackBarTheme: const SnackBarThemeData(
          backgroundColor: graphite, contentTextStyle: TextStyle(color: white),
          behavior: SnackBarBehavior.floating),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
          backgroundColor: yellow, foregroundColor: graphite),
    );
  }
}

String money(double v) =>
    '\$${v.toStringAsFixed(0).replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',')}';

class Pill extends StatelessWidget {
  final String text;
  final Color color;
  const Pill(this.text, this.color, {super.key});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
            color: color.withAlpha(36), borderRadius: BorderRadius.circular(20)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 7, height: 7, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Text(text, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w800)),
        ]),
      );
}

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title, text;
  const EmptyState(this.icon, this.title, this.text, {super.key});
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
                width: 72, height: 72,
                decoration: const BoxDecoration(color: RT.white, shape: BoxShape.circle),
                child: Icon(icon, size: 34, color: RT.dark)),
            const SizedBox(height: 16),
            Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(text, textAlign: TextAlign.center, style: const TextStyle(color: RT.dark)),
          ]),
        ),
      );
}

class MachineCard extends StatelessWidget {
  final Machine m;
  final VoidCallback? onTap;
  final Widget? trailing;
  const MachineCard(this.m, {super.key, this.onTap, this.trailing});
  @override
  Widget build(BuildContext context) => Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              Container(
                  width: 64, height: 64,
                  decoration: BoxDecoration(color: RT.graphite, borderRadius: BorderRadius.circular(14)),
                  child: Icon(m.icon, color: RT.yellow, size: 32)),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(m.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  const SizedBox(height: 2),
                  Text('${m.provider} · ${m.city}', style: const TextStyle(color: RT.dark, fontSize: 12.5)),
                  const SizedBox(height: 8),
                  Row(children: [
                    Pill(m.status.label, m.status.color),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Align(
                        alignment: Alignment.centerRight,
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text.rich(TextSpan(children: [
                            TextSpan(text: money(m.price), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                            const TextSpan(text: ' /día', style: TextStyle(color: RT.dark, fontSize: 12)),
                          ])),
                        ),
                      ),
                    ),
                  ]),
                ]),
              ),
              if (trailing != null) trailing!,
            ]),
          ),
        ),
      );
}
