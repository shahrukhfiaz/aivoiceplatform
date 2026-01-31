FROM node:22-alpine As development

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

###################
# BUILD FOR PRODUCTION
###################

FROM node:22-alpine As build

WORKDIR /usr/src/app

COPY --chown=node:node --from=development /usr/src/app/node_modules ./node_modules

COPY --chown=node:node dsai_tools/dsai_transfer.js dsai_tools/dsai_transfer.js

COPY --chown=node:node dsai_tools/dsai_hangup.js dsai_tools/dsai_hangup.js

COPY --chown=node:node loadTools.js loadTools.js

COPY --chown=node:node index.js index.js

USER node

CMD [ "node", "index.js" ]