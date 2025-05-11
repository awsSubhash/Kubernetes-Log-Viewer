FROM node:18-alpine
WORKDIR /app
COPY backend/ ./backend
COPY frontend/ ./frontend
RUN cd backend && npm install
CMD ["node", "backend/index.js"]

