import axios from "axios";
import crypto from "crypto";

const BASE_URL = "https://www.okx.com";

function createSignature(
  timestamp: string,
  method: string,
  requestPath: string,
  body: string,
  secret: string
) {
  const prehash = timestamp + method + requestPath + body;
  return crypto
    .createHmac("sha256", secret)
    .update(prehash)
    .digest("base64");
}

export async function testOKXConnection(
  apiKey: string,
  secret: string,
  passphrase: string
) {
  const requestPath = "/api/v5/account/balance";
  const method = "GET";
  const body = "";
  const timestamp = new Date().toISOString();

  const signature = createSignature(
    timestamp,
    method,
    requestPath,
    body,
    secret.trim()
  );

  try {
    const response = await axios.get(BASE_URL + requestPath, {
      headers: {
        "OK-ACCESS-KEY": apiKey.trim(),
        "OK-ACCESS-SIGN": signature,
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": passphrase.trim(),
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error: any) {
    return error.response?.data || error.message;
  }
}