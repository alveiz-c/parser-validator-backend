const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const axios = require("axios");
const { JSDOM } = require("jsdom");
const path = require("path");
const app = express();

// Enable CORS
app.use(cors());

// Setup file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tempDir = path.join(__dirname, "temp");
    fs.promises
      .mkdir(tempDir, { recursive: true }) // Create temp dir if it doesn't exist
      .then(() => cb(null, tempDir))
      .catch((err) => cb(err));
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + "-" + Date.now() + "-" + file.originalname);
  },
});

// Specify the URL for the file upload
const uploadUrl = "https://apps.chronicle.security/partner-tools/";

const upload = multer({ storage: storage });

// Single file upload route
app.post("/upload", upload.fields([{ name: "logFile" }]), async (req, res) => {
  if (!req.files || !req.files.logFile) {
    return res.status(400).send("Please upload a log file");
  }

  // You can now access the uploaded files using req.files['configFile'] and req.files['logFile']
  console.log(req.files);

  try {
  // Read the files as streams
  const logFileStream = fs.createReadStream(req.files.logFile[0].path);
  //const confFileStream = fs.createReadStream(req.files.configFile[0].path);
  const confFilePath = path.join(
    __dirname,
    "temp",
    `${Date.now()}_config.conf`
  ); // Create a file path within the directory
  await fs.promises.writeFile(confFilePath, req.body.configFile);
  const confFileStream = fs.createReadStream(confFilePath);
  await axios
    .post(
      uploadUrl,
      {
        configFile: confFileStream,
        logFile: logFileStream,
      },
      {
        headers: {
          // Add any other headers from your original request if needed
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          Referer: "https://apps.chronicle.security/partner-tools/",
          // Add any other headers from your original request if needed
          "Content-Type": "multipart/form-data",
        },
      }
    )
    .then((response) => {
      const output = response.data
        .replace("<h2>Parsing Results</h2>", "")
        .replace(
          /<a href="\/partner-tools\/" class="btn btn-lg btn-block chronicle-button">\s*Go back\s*<\/a>/g,
          ""
        );
      const dom = new JSDOM(output);
      const document = dom.window.document;

      // Find the element by ID and remove it
      const masthead = document.querySelector("#masthead");
      if (masthead) {
        masthead.parentNode.removeChild(masthead);
      }
      const sidebar = document.querySelector("#sidebar");
      if (sidebar) {
        sidebar.parentNode.removeChild(sidebar);
      }
      const ths = document.querySelectorAll("th");
      ths.forEach((th) => {
        th.style.color = "white";
      });
      const pres = document.querySelectorAll("pre");
      pres.forEach((pre) => {
        pre.style.color = "white";
        pre.style.whiteSpace = "pre-wrap";
        //check if "No errors, all rows parsed successfully." is in output, if not, set max width to 20vw
        //if (!pre.textContent.includes('events:'))
        //  pre.style.maxWidth = '20vw'
        pre.style.overflowX = "auto";
      });
      // Select all tables using `querySelectorAll`
      const tables = document.querySelectorAll("table");
      // Loop through each table
      tables.forEach((table) => {
        // Select all `<pre>` elements within the current table
        const preElements = table.querySelectorAll("pre");

        // Loop through each `<pre>` element and modify it
        preElements.forEach((preElement) => {
          preElement.style.maxWidth = "20vw";
        });
      });
      const tds = document.querySelectorAll("td");
      tds.forEach((td) => {
        td.style.color = "white";
      });

      // Serialize the document back to a string
      const updatedOutput = dom.serialize();
      fs.writeFileSync("z.html", updatedOutput);
      return res.status(200).json(updatedOutput);
    })
    .catch((error) => {
      console.error("Error:", error.message);
      return res.status(400).json(error);
    })
    .finally(async () => {
      // Delete temporary files after processing
      try {
        await fs.promises.unlink(req.files.logFile[0].path);
        await fs.promises.unlink(confFilePath);
      } catch (err) {
        console.error("Error deleting temporary files:", err.message);
      }
    });}
    catch (error) {
      console.error("Error", error.message);
      return res.status(400).json(error)
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
