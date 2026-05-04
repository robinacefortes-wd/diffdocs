# Stage 1: Build React/Vite assets
FROM node:22-alpine AS build-stage
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build

# Stage 2: Final Production Image (Updated to PHP 8.4)
FROM serversideup/php:8.4-fpm-nginx
WORKDIR /var/www/html

# Switch to root to handle permissions and copying
USER root

# Copy the built assets from the previous stage
COPY --from=build-stage /app /var/www/html

# Laravel setup
ENV WEBROOT /var/www/html/public
ENV APP_ENV production

# Install dependencies using PHP 8.4
RUN composer install --no-dev --optimize-autoloader

# Set correct permissions for Laravel
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/cache

EXPOSE 80