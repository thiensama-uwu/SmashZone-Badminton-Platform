const { AppError } = require("./errors");

async function requestJson(method, url, options = {}) {
  const headers = {
    "content-type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    throw new AppError(response.status, data?.code || "DOWNSTREAM_ERROR", data?.message || "Downstream request failed", data?.details || data);
  }

  return data;
}

module.exports = {
  requestJson,
};
