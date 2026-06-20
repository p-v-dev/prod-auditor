FROM node:latest

WORKDIR /app

COPY . .

RUN npm install --production

EXPOSE 3000

ENV NODE_ENV=production
ENV DB_PASS=MinhaSenhaSuperSecreta123!
ENV API_KEY=sk-live-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

CMD ["node", "server.js"]
