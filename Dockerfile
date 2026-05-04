FROM richarvey/nginx-php-fpm:latest

COPY . /var/www/html

# Build React assets using Node 20
RUN apk add --no-cache nodejs-current npm
RUN npm install && npm run build

# Laravel setup
ENV WEBROOT /var/www/html/public
ENV APP_ENV production
RUN composer install --no-dev --optimize-autoloader

EXPOSE 80