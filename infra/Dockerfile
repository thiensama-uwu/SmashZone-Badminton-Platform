FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/api-gateway/package.json backend/api-gateway/package.json
COPY backend/auth-service/package.json backend/auth-service/package.json
COPY backend/booking-service/package.json backend/booking-service/package.json
COPY backend/court-service/package.json backend/court-service/package.json
COPY backend/notification-service/package.json backend/notification-service/package.json
COPY backend/payment-service/package.json backend/payment-service/package.json
COPY backend/report-service/package.json backend/report-service/package.json
COPY backend/user-service/package.json backend/user-service/package.json

RUN npm ci

COPY backend ./backend

RUN npm run prisma:generate

CMD ["npm", "run", "start:all"]
