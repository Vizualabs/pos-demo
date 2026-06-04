FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:18-alpine
RUN npm install -g serve
WORKDIR /app/dist
COPY --from=build /app/dist .
EXPOSE 5000
CMD ["serve", "-s", ".", "-l", "5000"]