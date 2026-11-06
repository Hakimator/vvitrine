# Security policy

## Supported versions

The latest minor release receives security fixes.

## Reporting a vulnerability

Please use GitHub's **private vulnerability reporting** (Security tab > Report a vulnerability). Do not open a public
issue. You will get an answer within 7 days.

## Scope notes

VVitrine generates static sites: there is no server or database at runtime. The main risks are in the build
(dependencies, untrusted plugins) and in content rendered into pages. Head tags contributed by plugins are escaped by the
kernel; design token values are validated before being written into CSS.
