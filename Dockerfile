FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p logs public/uploads/avatars public/uploads/covers public/uploads/images public/uploads/videos public/uploads/chat

EXPOSE 3000

USER node

CMD ["npm", "start"]