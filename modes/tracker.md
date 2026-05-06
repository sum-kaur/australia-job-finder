# Modo: tracker — Tracker de Aplicaciones

Lee y muestra `data/applications.md`.

Si el usuario pide exportar a CSV / spreadsheet / Excel / Google Sheets, ejecuta:
```bash
node export-tracker.mjs
```
Esto genera `output/tracker.csv`. Luego indica al usuario que puede abrirlo en Excel directamente o importarlo en Google Sheets (File → Import → Upload).

**Formato del tracker:**
```markdown
| # | Fecha | Empresa | Rol | Score | Estado | PDF | Report |
```

Estados posibles: `Evaluada` → `Aplicado` → `Respondido` → `Contacto` → `Entrevista` → `Oferta` / `Rechazada` / `Descartada` / `NO APLICAR`

- `Aplicado` = el candidato envió su candidatura
- `Respondido` = Un recruiter/empresa contactó y el candidato respondió (inbound)
- `Contacto` = El candidato contactó proactivamente a alguien de la empresa (outbound, ej: LinkedIn power move)

Si el usuario pide actualizar un estado, editar la fila correspondiente.

Mostrar también estadísticas:
- Total de aplicaciones
- Por estado
- Score promedio
- % con PDF generado
- % con report generado
