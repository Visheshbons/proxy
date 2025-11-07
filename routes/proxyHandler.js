import fetch from "node-fetch";
import chalk from "chalk";
import { logProxyRequest } from "../utils/proxySessionManager.js";

function log(msg, type = "info") {
  let prefix;
  switch (type) {
    case "error":
      prefix = `[${chalk.red("ERROR")}]`;
      console.error(prefix, msg);
      break;
    case "info":
      prefix = `[${chalk.blue("INFO")}]`;
      console.log(prefix, msg);
      break;
    case "warning":
      prefix = `[${chalk.yellow("WARNING")}]`;
      console.warn(prefix, msg);
      break;
  }
}

function decodeBase64(data) {
  return Buffer.from(data, "base64").toString("utf8");
}

function parseEncryptedRequest(encryptedRequest) {
  try {
    const decodedBase64 = decodeBase64(encryptedRequest);
    return JSON.parse(decodedBase64);
  } catch (error) {
    throw new Error(`Failed to decrypt request: ${error.message}`);
  }
}

const BLOCKED_DOMAINS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "192.168.",
  "10.",
  "172.16.",
];

function isBlockedDomain(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    return BLOCKED_DOMAINS.some((blocked) => hostname.includes(blocked));
  } catch {
    return true;
  }
}

export async function handleProxyRequest(req, res, sessionId, user) {
  try {
    const { encryptedRequest } = req.body;

    if (!encryptedRequest) {
      return res
        .status(400)
        .json({ success: false, error: "Missing encryptedRequest parameter" });
    }

    let decrypted;
    try {
      decrypted = parseEncryptedRequest(encryptedRequest);
    } catch (error) {
      log(
        `Decryption failed for user ${chalk.grey.italic(user.username)}: ${error.message}`,
        "error",
      );
      return res
        .status(400)
        .json({
          success: false,
          error: "Failed to decrypt request",
          details: error.message,
        });
    }

    const { url, method = "GET", headers: reqHeaders = {}, body } = decrypted;

    if (!url) {
      return res
        .status(400)
        .json({ success: false, error: "Missing URL in decrypted request" });
    }

    if (isBlockedDomain(url)) {
      log(
        `Blocked local domain access attempt from ${chalk.grey.italic(user.username)}: ${url}`,
        "warning",
      );
      return res
        .status(403)
        .json({
          success: false,
          error: "Access to this domain is not allowed",
        });
    }

    const allowedMethods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"];
    const normalizedMethod = (method || "GET").toUpperCase();

    if (!allowedMethods.includes(normalizedMethod)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid HTTP method" });
    }

    const cleanHeaders = {};
    const forbiddenHeaders = [
      "host",
      "connection",
      "content-length",
      "transfer-encoding",
    ];

    for (const [key, value] of Object.entries(reqHeaders || {})) {
      if (!forbiddenHeaders.includes(key.toLowerCase())) {
        cleanHeaders[key] = value;
      }
    }

    const fetchOpts = {
      method: normalizedMethod,
      headers: cleanHeaders,
      timeout: 30000,
    };

    if (body && ["POST", "PUT", "PATCH"].includes(normalizedMethod)) {
      fetchOpts.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(url, fetchOpts);
    } catch (error) {
      log(
        `Proxy request failed for ${chalk.grey.italic(user.username)}: ${error.message}`,
        "error",
      );
      return res.json({
        success: true,
        response: {
          status: 502,
          statusText: "Bad Gateway",
          headers: {},
          body: `Failed to reach destination server: ${error.message}`,
        },
      });
    }

    let resBody;
    try {
      resBody = await response.text();
    } catch (error) {
      resBody = "Failed to read response body";
    }

    try {
      await logProxyRequest(
        sessionId,
        user._id.toString(),
        url,
        normalizedMethod,
        response.status,
      );
    } catch (logError) {
      log(`Failed to log proxy request: ${logError.message}`, "error");
    }

    const resHdrs = Object.fromEntries(response.headers);
    delete resHdrs["content-security-policy"];
    delete resHdrs["x-content-security-policy"];
    delete resHdrs["x-frame-options"];
    delete resHdrs["x-xss-protection"];
    delete resHdrs["strict-transport-security"];
    delete resHdrs["access-control-allow-origin"];
    delete resHdrs["access-control-allow-credentials"];

    const contentType = resHdrs["content-type"] || "";
    let finalBody = resBody;

    if (contentType.includes("text/html")) {
      const baseUrl = new URL(url).origin;
      const baseTag = `<base href="${baseUrl}/">`;
      finalBody = resBody.replace(/<head[^>]*>/i, (match) => match + baseTag);
    }

    const resObj = {
      status: response.status,
      statusText: response.statusText,
      headers: resHdrs,
      body: finalBody,
    };

    res.json({ success: true, response: resObj });

    log(
      `Proxy request completed for ${chalk.grey.italic(user.username)}: ${normalizedMethod} ${url} -> ${response.status}`,
      "info",
    );
  } catch (error) {
    log(`Proxy handler error: ${error.message}`, "error");
    res
      .status(500)
      .json({
        success: false,
        error: "Internal proxy error",
        details: error.message,
      });
  }
}
