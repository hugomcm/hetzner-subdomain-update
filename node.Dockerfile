FROM alpine:3.14

ARG NODE_VERSION='14.17.1'
ARG USER='appusr'
ARG GROUP='appgrp'
ARG PROJ='subdomain'
# ARG SUBPROJ

RUN echo "Node Version: ${NODE_VERSION}"
RUN echo "User/Group: ${USER}/${GROUP}"
RUN echo "Project Name: ${PROJ}"

# Install node
RUN apk add --update nodejs=${NODE_VERSION}-r0

# Install pnpm
RUN apk add --no-cache curl && \
  curl -f https://get.pnpm.io/v6.7.js | node - add --global pnpm && \
  apk del curl 
  # && \
  # pnpm add -g nodemon && \
  # pnpm rm -g pnpm && rm -rf ~/.pnpm-store

# Change user to appusr
RUN addgroup -S ${GROUP} -g 1000 && adduser -S ${USER} -u 1000 -G ${GROUP}
USER ${USER}

# Copy main sub-project
RUN mkdir -p /home/${USER}/${PROJ}/app
WORKDIR /home/${USER}/${PROJ}/app
COPY --chown=${USER}:${GROUP} . .
RUN pnpm i

# Run APP
ENTRYPOINT ["node", "index.js"]
