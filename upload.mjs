import fs from "fs";
import fetch from "node-fetch";
import FormData from "form-data";
import dotenv from "dotenv";

// .env ファイルの内容を読み込む
dotenv.config();

const API_URL = "https://api.ai.sakura.ad.jp/v1/documents/upload/";
const TOKEN = process.env.SAKURA_AI_TOKEN; // .envから取得
const FILE_PATH = "test.pdf"; // アップロードするファイル

if (!TOKEN) {
  console.error(".env に SAKURA_AI_TOKEN が設定されていません。");
  process.exit(1);
}

async function uploadFile() {
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(FILE_PATH));

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${TOKEN}`,
        ...form.getHeaders(),
      },
      body: form,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const result = await response.json();
    console.log("アップロード成功:", result);
  } catch (error) {
    console.error("アップロード失敗:", error);
  }
}

uploadFile();