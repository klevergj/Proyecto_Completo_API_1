---
inclusion: always
---
# Producto: Resuelve — API de Evaluación de Crédito

## Qué es
Resuelve es la unidad de crédito de una cadena retail. Este proyecto expone
su motor de evaluación crediticia como una API que otros canales (tiendas
físicas, apps, franquicias) consumen para aprobar crédito en segundos, en
vez de depender de un analista humano.

## Objetivo de negocio (Goal)
Automatizar la aprobación de crédito de bajo/mediano monto, dejando la
revisión manual solo para casos ambiguos.

## Resultados medibles (Outcome/KPI) — no negociables en el diseño
- 95% de solicitudes resueltas en menos de 3 segundos
- Al menos 60% de evaluaciones resueltas SIN consultar el buró externo
  (reglas internas primero — impacta costo variable por consulta)
- Soporta picos de 100-500 usuarios concurrentes sin degradar
- p95 de latencia < 500ms bajo carga sostenida
- Tasa de error < 1% bajo carga sostenida

## Reglas de negocio del motor de decisión
1. Score de buró externo bajo el umbral → rechazo automático
2. Mora vigente en repositorio interno → rechazo automático (sin consultar buró)
3. Relación cuota/ingreso alta → rechazo o revisión manual
4. Cliente nuevo sin historial + buen score externo → revisión manual
5. Monto bajo + historial limpio → aprobación automática

Cualquier feature nueva debe evaluarse contra estos KPIs y reglas antes de
implementarse.
