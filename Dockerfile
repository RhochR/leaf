# Leaf-Server — zero-dependency Node.js, daher kein "npm install"-Layer nötig.
# Erwartet server.js und web/ im selben relativen Layout wie im Repo (server.js
# findet web/ über einen Pfad relativ zu sich selbst, siehe server/server.js).
FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY server ./server
COPY web ./web

# server/data/db.json entsteht erst beim ersten Schreiben — Verzeichnis vorab anlegen
# und dem eingebauten "node"-User gehören lassen, damit der Container nicht als root
# läuft und trotzdem in server/data schreiben darf (als Volume zu mounten, siehe README).
RUN mkdir -p server/data && chown -R node:node /app
USER node

ENV PORT=8080
EXPOSE 8080
VOLUME ["/app/server/data"]

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:${PORT}/ || exit 1

# LEAF_PASSPHRASE ist bewusst NICHT hier gesetzt — kommt beim "docker run" von außen,
# siehe README.md.
CMD ["node", "server/server.js"]
