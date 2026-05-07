# Stage 1: Build React/Vite assets
FROM node:22-alpine AS build-stage
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM serversideup/php:8.4-fpm-nginx
WORKDIR /var/www/html

USER root

# Copy application source
COPY --from=build-stage /app /var/www/html

# Environment
ENV WEBROOT=/var/www/html/public
ENV APP_ENV=production

# Install Composer dependencies
RUN composer install --no-dev --optimize-autoloader --no-interaction

RUN mkdir -p /var/www/html/storage/logs \
             /var/www/html/storage/framework/cache \
             /var/www/html/storage/framework/sessions \
             /var/www/html/storage/framework/views \
             /var/www/html/bootstrap/cache

# correct permissions
RUN chown -R www-data:www-data \
        /var/www/html/storage \
        /var/www/html/bootstrap/cache && \
    chmod -R 775 \
        /var/www/html/storage \
        /var/www/html/bootstrap/cache

EXPOSE 80