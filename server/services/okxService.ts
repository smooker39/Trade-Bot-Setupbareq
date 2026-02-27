import axios from "axios";
import crypto from "crypto";

export class OKXService {
  private baseUrl = "https://www.okx.com";
  private apiKey = process.env.OKX_API_KEY?.trim();
  private apiSecret = process.env.OKX_API_SECRET?.trim();
  private passphrase = process.env.OKX_PASSPHRASE?.trim();

  async initialize() {
    if (!this.apiKey || !this.apiSecret || !this.passphrase) {
      throw new Error("Missing OKX API credentials in Secrets");
    }
    return this.checkConnection();
  }

  private generateSignature(timestamp: string, method: string, requestPath: string, body: string = "") {
    const message = timestamp + method.toUpperCase() + requestPath + body;
    return crypto.createHmac("sha256", this.apiSecret!).update(message).digest("base64");
  }

  private getHeaders(method: string, requestPath: string, body: string = "") {
    const timestamp = new Date().toISOString();
    return {
      "OK-ACCESS-KEY": this.apiKey,
      "OK-ACCESS-SIGN": this.generateSignature(timestamp, method, requestPath, body),
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": this.passphrase,
      "Content-Type": "application/json",
    };
  }

  async checkConnection() {
    try {
      const path = "/api/v5/account/balance";
      const response = await axios.get(this.baseUrl + path, {
        headers: this.getHeaders("GET", path),
      });
      if (response.data.code === "0") {
        console.log("[OKX] ✅ Connected Successfully");
        return true;
      } else {
        throw new Error(response.data.msg);
      }
    } catch (error: any) {
      console.error("[OKX] ❌ Connection Failed:", error.response?.data?.msg || error.message);
      throw error;
    }
  }
}

export const okxService = new OKXService();
