FROM alpine:3.19
# postgresql-client provides pg_isready for healthcheck
RUN apk add --no-cache pgbouncer postgresql-client
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 5432
ENTRYPOINT ["/entrypoint.sh"]
