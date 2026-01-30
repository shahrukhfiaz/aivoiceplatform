# Fix for broken agentvoiceresponse/avr-core image using multi-stage build
# Stage 1: Use a working base to set up users
FROM node:22-alpine AS base

# Create proper passwd and group files
RUN cat /etc/passwd > /tmp/passwd && \
    cat /etc/group > /tmp/group

# Stage 2: Fix the broken image
FROM agentvoiceresponse/avr-core:latest

# Copy passwd/group from working base image
COPY --from=base /tmp/passwd /etc/passwd
COPY --from=base /tmp/group /etc/group

USER node
