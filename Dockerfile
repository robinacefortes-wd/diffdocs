# Stage 1: Build React/Vite assets
FROM node:22-alpine AS build-stage
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build

# Stage 2: Final Production Image
FROM richarvey/nginx-php-fpm:latest
WORKDIR /var/www/html

# Copy the built assets from the previous stage
COPY --from=build-stage /app /var/www/html

# Laravel setup
ENV WEBROOT /var/www/html/public
ENV APP_ENV production
RUN composer install --no-dev --optimize-autoloader

EXPOSE 80