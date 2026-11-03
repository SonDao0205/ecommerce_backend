import { registerAs } from '@nestjs/config';

export const elasticConfig = registerAs('elasticsearch', () => {
  const apiKey = process.env.ELASTICSEARCH_API_KEY;
  const username = process.env.ELASTICSEARCH_USERNAME;
  const password = process.env.ELASTICSEARCH_PASSWORD;
  const requestTimeout = Number(
    process.env.ELASTICSEARCH_REQUEST_TIMEOUT ?? 5000,
  );

  return {
    node: process.env.ELASTICSEARCH_NODE ?? 'http://localhost:9200',
    requestTimeout:
      Number.isFinite(requestTimeout) && requestTimeout > 0
        ? requestTimeout
        : 5000,
    maxRetries: 1,
    ...(apiKey
      ? { auth: { apiKey } }
      : username && password
        ? { auth: { username, password } }
        : {}),
  };
});
