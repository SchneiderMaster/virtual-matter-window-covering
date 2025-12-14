# ----------------------------------------------------
# STAGE 1: Build-Umgebung (Installation von Abhängigkeiten)
# ----------------------------------------------------
# Verwendung des offiziellen Node-Images, das Multi-Arch-fähig ist (für Pi Zero W2)
FROM node:20-slim AS build

# Das Arbeitsverzeichnis im Container
WORKDIR /app

# Kopiere nur die Paketdateien, um den Docker-Cache optimal zu nutzen
COPY . .

# Installiere Node-Abhängigkeiten
RUN npm install

# ----------------------------------------------------
# STAGE 2: Produktions-Image (Minimal und sicher)
# ----------------------------------------------------
# Nutze ein noch kleineres Basis-Image für die finale Laufzeit
FROM node:20-slim

# Das Arbeitsverzeichnis der Anwendung
WORKDIR /app

# Kopiere die Abhängigkeiten und den Code aus der Build-Stufe
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app .

# **WICHTIG:** Port freigeben
# Dies informiert Docker, dass der Container Port 3000 nutzt
EXPOSE 3000

# Startbefehl: Ersetzen Sie 'server.js' durch Ihre Startdatei
CMD ["node", "./dist/main.js"]