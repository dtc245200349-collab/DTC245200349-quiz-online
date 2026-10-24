#!/bin/sh
# Runs only on an empty volume during the official MySQL entrypoint initialization.
# A subshell avoids changing shell flags when the entrypoint sources this file.
(
set -eu
case "$MYSQL_DATABASE" in ''|*[!a-zA-Z0-9_]*) echo 'Invalid MYSQL_DATABASE' >&2; exit 1;; esac
case "$MYSQL_USER" in ''|*[!a-zA-Z0-9_]*) echo 'Invalid MYSQL_USER' >&2; exit 1;; esac
if [ "$MYSQL_USER" = root ]; then echo 'Application user must not be root' >&2; exit 1; fi
MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket -uroot <<SQL
REVOKE ALL PRIVILEGES, GRANT OPTION FROM '${MYSQL_USER}'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_USER}'@'%';
SQL
)
