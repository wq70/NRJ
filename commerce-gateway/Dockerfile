FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && mkdir -p /app/runtime && chown -R pwuser:pwuser /app
COPY --chown=pwuser:pwuser src ./src
USER pwuser
ENV HOST=0.0.0.0 PORT=8790
EXPOSE 8790
CMD ["node", "src/server.mjs"]
