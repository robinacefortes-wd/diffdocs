# Stage 1: Build React/Vite assets
FROM node:22-alpine AS build-stage
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Final Production Image
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

# Ensure bootstrap/cache exists (Laravel standard path)
RUN mkdir -p /var/www/html/storage/logs \
             /var/www/html/storage/framework/cache \
             /var/www/html/storage/framework/sessions \
             /var/www/html/storage/framework/views \
             /var/www/html/bootstrap/cache

# Set correct permissions
RUN chown -R www-data:www-data \
        /var/www/html/storage \
        /var/www/html/bootstrap/cache && \
    chmod -R 775 \
        /var/www/html/storage \
        /var/www/html/bootstrap/cache

EXPOSE 80