/**
 * HỆ THỐNG CHẤM CÔNG HRM PRO - ULTIMATE EDITION V12.8
 * ---------------------------------------------------------------
 * TRẠNG THÁI: FINAL FULL UNCOMPRESSED (KHÔNG NÉN)
 * TÍNH NĂNG:
 * - Chấm công (Chọn ngày), Tính lương, Thuế, Nghỉ phép.
 * - Mobile API, Email Template, PDF Payslip.
 * - Auto Backup (ETL Flatten JSON), Auto Folder Structure.
 * - An toàn dữ liệu (Safe Date/JSON Parsing).
 * - TỐI ƯU TỐC ĐỘ: Client Cache & Server Snapshot.
 */

const APP_NAME = "HRM SUNNYCARE";
const DB_ID_PROP = "HRM_DB_ID";
const PAYSLIP_LOGO_SUNNYCARE_DRIVE_ID = "1G8LtDowZsg-D2gJNGfY96s9_cSKxms4z";
const PAYSLIP_LOGO_METTASOUL_DRIVE_ID = "1zRBS1XkN1pAUtmAcLaLrTt39-fpa9ei1";
const PAYSLIP_LOGO_SUNNYCARE = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAwAGgDASIAAhEBAxEB/8QAHAAAAQUBAQEAAAAAAAAAAAAAAAMEBQYHAgEI/8QAMxAAAQMDAwIEBAQHAQAAAAAAAQIDBAAFEQYSITFBEyJhcRQyUZEHgaGxFSMkUmLw8TP/xAAaAQADAQEBAQAAAAAAAAAAAAADBAUAAgYB/8QAMBEAAQMDAwIEBQMFAAAAAAAAAQIDEQAEIRIxQVGBBWFxkRMUMrHwIiPRQmKhwfH/2gAMAwEAAhEDEQA/APsus6/ENVxtepI92YdWEFI2Hskjgp9u/rn3q0Q9W6flSTHbuCErBwCsFIPsTxT6+2yPeLW5DexhYyhXXarsf97VA8VZb8Xs1JtXAVJMgg8j0/OacYKrZ0FxOD16V1ZLg3dLWxOawA6nJH9quhH3qEsd8mTNY3G2OkfDspXsASPLtUE9fWm34c/EwHbhZJaSlxhYWnJzkHg49Pl+9LWOKImpL9cnBhDeeffzn9APvSab+4uGrR2Sk6iF8fSlUz7HHpRC0hCnE74x3IirUCCSAQSOvpXtQmm0Li292dOdCVPr3kk8AdvuST+YqZacQ60lxtW5ChkH6irfh1982whxQ0qUJ0zmJwe4jvik3EaFEDNdUUUVQodFFFFatRRRRWrUUUUVq1VC/aCtk91T8NxcJ5XOEjcjPt2+/wCVIWSHqrTiwypCbpbxwENr86B/jnH26fvXF1l6/RcnkxYLRjhZ8PYEEKTnjk8/tUjZrhrEgC5WKORnG5L6UED69Tn9K8clqyVdFbLTjSwfqCTB7QRHaq5Lwaha0qHQkT/r71MqRDL7V3cPw6w0WypzyeUkHCs/QilFi3rjukrYLL6h4igsYWTgDJ9cAVE6htQn3a2y5bC5ERkKC2krI8NZwUuYHzDggj196jtR3ISYUqCvwy7DmR9y2z5VoWrKT6Hggj09asv3AYS5rQIzH9x0yfTGOdjNKtsfFKQk+vlmKsM+PBXIQqfITtSkqQ0tYSgADzHHfHf0p6XWW20KLjaEKISglQAJPQD3ql/iQCq4wRyB8BO5Hb+Wmo74l63wrTYpzql/1UV6E6of+jRIyj3STj29MUovxBu0uXgGxOJV1MAgH/IHA25FGbsi62hWrfjynitGS8ytCnEuoUhJIUoKBAI659q8ZkMPEhl5twhIUdiweD0PHY9qziM+/Z4t2luuqXbZz8llwEZDDvISr2PT8vankhuXB0zaL/ankNyjDajOhfKXErSAkn1ScH/mKIjxoqTqKNhKhzHUdcGfcbisrw8Axq3MD18/t7Haru9OhMR3JD0yO0y0opccW6AlBHUEk4BruJJjS46ZESQ1IZX8rjSwpKvYjis/u1kgo1XpXT08CTBLUqQtt0ZTKkJSnlQPzYBJAPbipLUjln0Lo+9zLO01EWfMlltXlQ8sBCCE5wkdDgY4Br0bLSlto1CFq44GYiagO3WhxwiNCOedpmO/WrYibDXFXKRLYUw3u3uhwFCdvzZPQYxz9KQhXi0znvBhXSDJdxnYzIQtWPYGsdsMiDaNN6s0pEu8e5su2Rc5pxl4OAOeDseTkf5AKA+ldafjrm3nS9qZ0dB09Na+HuH8QS8jfKZQBvA2JG4qGcpJJHcd6cNkBOf+RNTk+LqVphIk7jJzMRIEeYmK1pWo9PpWUKvtrCgcFJlt5z96KyvQFhnTrGxKb0fpafHXIe/qZgy8oB5QOfKemMD0Aorhy3bQopn7fzRmL24eQFhO/kr+K2dRCUlR6AZ6VVoN8vd7lKTabamHCSraZcxJJUO+1AIz98fWrVRUl9lbqkwspA3A3PfjtnzFXG3EoBlMnieO1IObFBMZcgh1ScjaraogdTj8x96j29OWZq1v21MRPw8g5dBUSVHPBz14PT6Unpq2TI7kq43VxDlwlL82w5S02D5UJ9Oc/wDM0z0ko3ixXKLcUrWn4+UyoKJBx4hOAe2M4BHTFLgpeKfit5IVE9MYPSRv7Zo+goCiheARMdfL04pzG0rb2kSPEfmylvNKZ8SQ+VqQg9QnPSurnGsryGY8pKz/AAxSHUKwcoKcYGe+Rjjv7jj3TEW+QDIh3SY3PjNkfCyTw8pP9rg6Ejjnv+z6TbI0iT8Q4XfEwNpCyNvTkfYf6TXKbVBZ/baAncEfk5yK+rdUlz9S5jYj86UyTFsgtkqA480WJC1KeQ46nIUvnHofp7Vy5HsyoDNhL/kYCUoSF+bLe04z9enFLyLFDWylpjcxgFOUkk7DnKemfJpw9bIjy3FuJWS4cnCyMHy9Pp8orr5ZUadCdo7ciufiiZ1Hee/WovVEKwX2A03PklstrS6y8w94bzCiQAoEcp6+32qNGj9Jwojbcpx2UUyUTnXJL/iuSFpBSguE/MkbjgdOvrVkZs8FkI2Nq8i94JUfm45/QUKtEM7docRtQlI2uEY2jAPvgkexpxL94lOkEe5pJdpZrXrUmT6CoO8aW0hcSgqbiRFoS6wVRVIZJDqChSVYHPB79xUnK03bJMe0srQ6DaXG1xHErwtOwAYJ7ggAEd6UfscRSUJZ3MBOEnaTyjcVFPsSalKI2/cHC+Ns+9cqtbYSUp33x02qmM/hzZ2AUxrnfY7e4qDbNxWhIJOTgDpyaKudFHNw6f6qALC2GyBX/9k=";
const PAYSLIP_LOGO_METTASOUL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAwADADASIAAhEBAxEB/8QAGwAAAwEAAwEAAAAAAAAAAAAABQYHBAECAwj/xAAxEAABAwMDAAkDBAMBAAAAAAABAgMEBQYRABIhBxMxMkFRYXGBFCIjFRZSgkOhwdH/xAAZAQACAwEAAAAAAAAAAAAAAAADBAABBQL/xAAqEQABAwIEBQMFAAAAAAAAAAABAgMRADEEEiFBE1FhcYEFMrGh0eHw8f/aAAwDAQACEQMRAD8A+u7gqrFGpi5r6VLIIQ20jvOrPCUj1J0HatyTWEfUXRLeeK+RBZdLbDQ/idpys+pPnrrcmZN921CXhTKBJlqQRkFaEpCD8FROmd1xtpIU4oJSTjJ7NEU4GUBUx1rP4QxTqg5qlOkbEwCSed4ANLa7HoTX5KaiTTJAH2vRZC0qHuCSCPca4Fi0F/8ALVESarJI+56VIWo/ABAA9hohU6qzTjIafVIkqWne21GjrfdCSMH7UAnGew/+azW7clNrrv0kCQ+y/FwZMaVHXHfAxx9iwDtJ8R7eOl045xZOWTF+msfm9qIr03BoICkJE2EaHxafFYpFry6Kj6q0Zj0dTfJp77pcjvD+I3HKCfMHy0atitR69SUT46FtK3KbeZX32XEnCkK9Qf8Ah0QZeaeSS0oLSDjI7Pg+OlC1j9H0mXVT0kJZkNRZyG+wBakqQ4oe5SM+umEuB5GaZ61XBGFdSECEq0jYGJkcrRFDLGuGkXDdkivSqtBZkuoMKm05UlIkIaCsqUtGchalDOMZAHjqgvKe3BKGUuIPeJXjHxjnSF0lsUuk121KuuPDhpNcSJEvq0o7zTmN68dhOO09unJit0d51DLNWgOOLISlCJKCVHyAB51T6c4BSSKmDJazIXBIN+c6zWK3SBW6425jrxIQTx/j2DYPbGdZLtaR+5rZeYCfrTMWjPiWOqUXB6ju/OtNyH9PmM1JtTiOuSYrxbGTgglKgDxkHXjbbC51dl1uS4F9W2mHFQTlTaRysqGcBSjg+wHOsrAYpDL6sIv3DMR1BMj51NpB5infUWy8hJTuU+MsfbTuKPsqe3lK2Ettp7pC85+Mcal3SZdFCtq8YF0Qq1TH58Mfp9VpiJSDJdjLWCNiM5K0LO7bjkE6osivURhxbL1YpzbiCUqQuUgFJHaCCeDpD6IolHq9avKtCJBmj9yvfSTOpQvIS00MoXjsCs8g4znWqynICVGaWxJLkITAPxG9UapQYVShOQqjEYlxXRhxl9sLQoeoPB1JOlmh2bZ0q0K4zRqZRo0e4GXJk1mIEbG0tuKwopGcFQT8gaazfc4JSVWhVmlqbCw26MLOUBRIABG1JICjnIyMBROBprt1zYcf8dsy54MVMnc0Cpogg8ZKQSoKA4wDg7uOzUQspNdvMpcFtaWq7fEa76U7TqJYV0XBEdAKZKoaIrCscgpXIxk/114W3ecOx6Qmm1qwLot+GhSnHJSYTcpgE8lS1xuw/wBewDTdQrtmz9yH7bqDexptwPJTuae3FAPVk8nG5XBwcJ8c50UjVeS+FbaU82oHBS4og9wq8vTHvoTmNabIbVv3PxVowTiiXgdbbf361LOh23bJvN28a7KoNJrUaTcslyHNfhhfWNKQ2rCSoZwFFXznVjpdPg0uA1ApsOPCiMp2tMMNhCEDyCRwNDJNbMJpITSJasqwlDTZJOU54AHnkf70PXeiG3UIco9RCC4Ap1LCyhLZVt63O3JTk+QPjjHOiJXx0502/RQ08NhWQ+7t5r//2Q==";

// ======================================================
// 1. CORE & UTILITIES (CẤU HÌNH CỐT LÕI)
// ======================================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚙️ HRM ADMIN')
    .addItem('🚀 Khởi tạo Hệ thống (Lần đầu)', 'initializeSystem')
    .addSeparator()
    .addItem('🧩 Khởi tạo tích hợp METTASOUL', 'setupMettasoulIntegration')
    .addSeparator()
    .addItem('📂 Kiểm tra/Tạo cấu trúc Thư mục', 'setupDriveFolders')
    .addItem('🔄 Đồng bộ & Bung nén Backup (Thủ công)', 'runSystemBackup')
    .addToUi();
}

function getDatabase() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      PropertiesService.getUserProperties().setProperty(DB_ID_PROP, ss.getId());
      PropertiesService.getScriptProperties().setProperty(DB_ID_PROP, ss.getId());
      return ss;
    }
  } catch (e) {
    console.log(e);
  }
  const scriptId = PropertiesService.getScriptProperties().getProperty(DB_ID_PROP);
  const userId = PropertiesService.getUserProperties().getProperty(DB_ID_PROP);
  const candidateIds = [scriptId, userId].filter(function(id, index, values) {
    return id && values.indexOf(id) === index;
  });
  for (let i = 0; i < candidateIds.length; i++) {
    try {
      return SpreadsheetApp.openById(candidateIds[i]);
    } catch (error) {
      console.log("Không mở được HRM database đã lưu: " + error);
    }
  }
  if (!candidateIds.length) {
    throw new Error("Không tìm thấy Database ID.");
  }
  throw new Error("Không thể mở HRM database đã lưu.");
}

/** One-time owner bootstrap for web-app deployments that have no active Sheet.
 *  This only validates and records the database ID; it never edits HR data. */
function bootstrapHrmDatabaseForOwner_(spreadsheetId) {
  const ss = SpreadsheetApp.openById(String(spreadsheetId || "").trim());
  PropertiesService.getScriptProperties().setProperty(DB_ID_PROP, ss.getId());
  PropertiesService.getUserProperties().setProperty(DB_ID_PROP, ss.getId());
  return { success: true, databaseName: ss.getName() };
}



function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle(APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Hàm an toàn để Parse JSON (Tránh lỗi crash khi chuỗi rỗng)
function safeJsonParseServer(str) {
  try {
    if (!str || str === "") return {};
    return JSON.parse(str);
  } catch (e) {
    return {};
  }
}

function roundMoney(amount) {
  return Math.round(amount);
}

function safeGet(row, index, defaultVal) {
  if (row && row.length > index && row[index] !== undefined && row[index] !== "") {
    return row[index];
  }
  return defaultVal;
}

function formatCurrencyVN(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount);
}

// Hàm xử lý ngày tháng an toàn (Tránh lỗi khi ô ngày trống)
function safeDateStr(val, format) {
  if (!val) return "";
  try {
    const d = (val instanceof Date) ? val : new Date(val);
    if (isNaN(d.getTime())) return "";
    return Utilities.formatDate(d, Session.getScriptTimeZone(), format);
  } catch (e) {
    return "";
  }
}

function checkIsLocked(monthStr) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("PayrollStatus");
  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();
  
  const row = data.find(r => {
    let rStr = safeDateStr(r[0], "yyyy-MM");
    if (!rStr) rStr = String(r[0]);
    rStr = rStr.replace("'", "");
    return rStr === monthStr;
  });

  if (!row) return false;
  const status = row[1];
  return (status === 'Waiting' || status === 'Approved');
}

// ======================================================
// 2. AUTHENTICATION & USER FEATURES
// ======================================================

function loginUser(email, password) {
  const ss = getDatabase();
  const data = ss.getSheetByName("Users").getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == email) {
      const settings = safeJsonParseServer(data[i][5] || "{}");
      if (String(settings.identityProvider || "").toUpperCase() === "METTASOUL") {
        return { success: false, message: "Tài khoản này được xác thực qua METTASOUL, không dùng mật khẩu HRM." };
      }
    }
    if (data[i][0] == email && data[i][1] == password) {
      return {
        success: true,
        role: data[i][2],
        name: data[i][3],
        email: data[i][0],
        settings: data[i][5],
        contractUrl: safeGet(data[i], 8, "")
      };
    }
  }
  return { success: false, message: "Sai email hoặc mật khẩu!" };
}

function changeUserPassword(email, oldPass, newPass) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == email) {
      const settings = safeJsonParseServer(data[i][5] || "{}");
      if (String(settings.identityProvider || "").toUpperCase() === "METTASOUL") {
        return { success: false, message: "Tài khoản này được quản lý bởi METTASOUL; không đổi mật khẩu tại HRM." };
      }
      if (String(data[i][1]) !== String(oldPass)) {
        return { success: false, message: "Mật khẩu cũ không đúng!" };
      }
      sheet.getRange(i + 1, 2).setValue(newPass);
      return { success: true, message: "Đổi mật khẩu thành công!" };
    }
  }
  return { success: false, message: "Không tìm thấy tài khoản" };
}

function getAllUsers() {
  const ss = getDatabase();
  const data = ss.getSheetByName("Users").getDataRange().getValues();
  return data.slice(1).map(r => {
    try {
      if (!r[0]) return null;
      return {
        email: r[0],
        password: r[1],
        role: r[2],
        name: r[3],
        settings: safeGet(r, 5, "{}"),
        dependents: safeGet(r, 6, 0), // Lấy Dependents từ cột G
        tags: safeGet(r, 7, ""),
        contractUrl: safeGet(r, 8, ""),
        // [CẬP NHẬT] Các trường mới
        staffCode: safeGet(r, 9, ""),      // Cột J
        workType: safeGet(r, 10, "Fulltime"), // Cột K
        contractExpire: safeDateStr(r[11], "yyyy-MM-dd"), // Cột L
        avatarUrl: safeGet(r, 12, ""),      // Cột M
        // [MỚI] Thêm 3 trường Ngân hàng (Cột N, O, P tương ứng index 13, 14, 15)
        bankName: safeGet(r, 13, ""),
        bankAccount: safeGet(r, 14, ""),
        bankBeneficiary: safeGet(r, 15, "")
      };
    } catch(e) { return null; }
  }).filter(u => u !== null);
}

// ======================================================
// 3. MASTER DATA & WORK LOGIC (DỮ LIỆU NỀN)
// ======================================================

function getTaskGroups() {
  return getDatabase().getSheetByName("TaskGroups").getDataRange().getValues().slice(1)
    .filter(r => r[3] !== 'Deleted' && r[0])
    .map(r => ({ id: r[0], name: r[1], desc: r[2] }));
}

function getAllTasks() {
  return getDatabase().getSheetByName("Tasks").getDataRange().getValues().slice(1)
    .filter(r => r[6] !== 'Deleted' && r[0])
    .map(r => ({
      id: r[0],
      groupId: r[1],
      name: r[2],
      unit: r[3],
      rate: r[4],
      fields: r[5],
      policyJson: safeGet(r, 7, "{}")
    }));
}

function getFinanceMasterData() {
  const ss = getDatabase();
  const getSheetData = (name) => {
    const s = ss.getSheetByName(name);
    return s ? s.getDataRange().getValues().slice(1) : [];
  };

  const salaryLevels = getSheetData("SalaryLevels").filter(r => r[3] !== 'Deleted' && r[0]).map(r => ({ id: r[0], name: r[1], amount: r[2] }));
  const deductionTypes = getSheetData("DeductionTypes").filter(r => r[4] !== 'Deleted' && r[0]).map(r => ({ id: r[0], name: r[1], desc: r[2], frequency: r[3] }));
  const deductionLevels = getSheetData("DeductionLevels").filter(r => r[4] !== 'Deleted' && r[0]).map(r => ({ id: r[0], typeId: r[1], name: r[2], amount: r[3] }));
  const taxConfig = getSheetData("TaxConfig").filter(r => r[4] !== 'Deleted' && r[0]).map(r => ({ id: r[0], min: r[1], max: r[2], percent: r[3] }));
  const leaveTypes = getSheetData("LeaveTypes").filter(r => r[3] !== 'Deleted' && r[0]).map(r => ({ id: r[0], name: r[1], mappedDeductions: safeGet(r, 2, "[]") }));
  
  const sysConfig = getSheetData("SystemConfig");
  const globalConfig = {};
  sysConfig.forEach(r => { if(r[0]) globalConfig[r[0]] = r[1]; });
  
  return { salaryLevels, deductionTypes, deductionLevels, taxConfig, leaveTypes, globalConfig };
}

function getNotifications(mode) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("Notifications");
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  let rows = data.slice(1);
  let notis = rows.map(r => ({
    id: r[0],
    title: r[1],
    content: r[2],
    type: r[3],
    date: safeDateStr(r[4], "yyyy-MM-dd"),
    author: r[5]
  }));

  notis.reverse();

  if (mode === 'admin') {
    return notis;
  } else {
    return notis.slice(0, 10);
  }
}

function saveNotification(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const ss = getDatabase();
    let sheet = ss.getSheetByName("Notifications");
    
    if (!sheet) {
      sheet = ss.insertSheet("Notifications");
      sheet.appendRow(["ID", "Title", "Content", "Type", "Date", "Author"]);
    }

    const timestamp = new Date();
    
    if (data.id) {
      const rows = sheet.getDataRange().getValues();
      let found = false;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] == data.id) {
          sheet.getRange(i + 1, 2).setValue(data.title);
          sheet.getRange(i + 1, 3).setValue(data.content);
          sheet.getRange(i + 1, 4).setValue(data.type);
          found = true;
          break;
        }
      }
      if (!found) return { success: false, message: "Không tìm thấy thông báo để sửa!" };
      return { success: true, message: "Đã cập nhật thông báo!" };
    } 
    else {
      const newId = "NOTI_" + timestamp.getTime();
      sheet.appendRow([newId, data.title, data.content, data.type, timestamp, data.author]);
      return { success: true, message: "Đã đăng thông báo mới!" };
    }

  } catch (e) {
    return { success: false, message: "Lỗi: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteNotification(id) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const ss = getDatabase();
    const sheet = ss.getSheetByName("Notifications");
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == id) {
        sheet.deleteRow(i + 1);
        return { success: true, message: "Đã xóa thông báo!" };
      }
    }
    return { success: false, message: "Không tìm thấy thông báo." };
  } catch (e) {
    return { success: false, message: "Lỗi xóa: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------
// WORK LOG LOGIC (XỬ LÝ CHẤM CÔNG)
// ------------------------------------------------------

function submitWorkLog(userEmail, taskObj, inputData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: "Hệ thống bận, vui lòng thử lại sau." };
  }

  try {
    let workDate;
    if (inputData && inputData.workDate) {
      workDate = new Date(inputData.workDate);
    } else {
      workDate = new Date();
    }

    if (isNaN(workDate.getTime())) {
      return { success: false, message: "Ngày thực hiện không hợp lệ!" };
    }

    let logDateStr = Utilities.formatDate(workDate, Session.getScriptTimeZone(), "yyyy-MM");
    if (checkIsLocked(logDateStr)) {
      return { success: false, message: `Tháng ${logDateStr} đã khóa sổ. Không thể chấm công!` };
    }

    const ss = getDatabase();
    // Không tin đơn giá/chính sách do trình duyệt gửi lên. Luôn đọc lại Tasks
    // từ HRM để giữ HRM là nguồn dữ liệu lương duy nhất.
    taskObj = getAuthoritativeTaskById_(ss, taskObj && taskObj.id);
    let quantity = 0;

    if (taskObj.unit === 'Phút') {
      if (!inputData.startTime || !inputData.endTime) return { success: false, message: "Thiếu giờ làm" };
      
      const dateString = Utilities.formatDate(workDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
      const s = new Date(dateString + "T" + inputData.startTime);
      const e = new Date(dateString + "T" + inputData.endTime);
      
      if (e < s) e.setDate(e.getDate() + 1);
      
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return { success: false, message: "Lỗi giờ" };
      quantity = Math.floor((e - s) / 60000);
    } else {
      quantity = parseFloat(inputData.quantity) || 0;
    }

    if (quantity <= 0) return { success: false, message: "Số lượng > 0" };

    let unitPrice = parseFloat(taskObj.rate) || 0;
    let bonusTotal = 0;
    let logNote = [];
    let policy = safeJsonParseServer(taskObj.policyJson);

    const userSheet = ss.getSheetByName("Users");
    const userRow = userSheet.getDataRange().getValues().find(r => r[0] == userEmail);
    const userTagsStr = (userRow) ? safeGet(userRow, 7, "").toUpperCase() : "";

    if (policy.roles && Array.isArray(policy.roles)) {
      policy.roles.forEach(roleRule => {
        if (roleRule.tag && userTagsStr.includes(roleRule.tag.toUpperCase())) {
          const amount = parseFloat(roleRule.amount) || 0;
          bonusTotal += amount;
          logNote.push(`${roleRule.tag}: +${amount}`);
        }
      });
    }

    let fieldsConfig = safeJsonParseServer(taskObj.fields);
    if (Array.isArray(fieldsConfig)) {
      fieldsConfig.forEach(field => {
        if (field.type === 'select' && field.optionsConfig) {
          const k = field.label.toLowerCase().replace(/\s+/g, '_');
          const v = inputData[k];
          if (v) {
            const opt = field.optionsConfig.find(o => o.value === v);
            if (opt && opt.bonus) {
              bonusTotal += parseFloat(opt.bonus);
              logNote.push(`${v}: +${opt.bonus}`);
            }
          }
        }
      });
    }

    const safeMoney = roundMoney((quantity * unitPrice) + bonusTotal);
    const sheet = ss.getSheetByName("WorkLogs");
    const inputJson = JSON.stringify(inputData) + (logNote.length > 0 ? ` [Bonus: ${logNote.join(', ')}]` : "");
    
    const timestamp = new Date(); 
    const logDateFormatted = Utilities.formatDate(workDate, Session.getScriptTimeZone(), "yyyy-MM-dd"); 
    
    sheet.appendRow([
      "LOG_" + timestamp.getTime(), 
      userEmail, 
      taskObj.id, 
      taskObj.name, 
      inputJson, 
      quantity, 
      safeMoney, 
      timestamp, 
      logDateFormatted,
      "Active"
    ]);
    
    return { success: true, money: safeMoney };

  } catch (e) {
    return { success: false, message: "Lỗi: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function processUpdateLog(logId, userEmail, newData, isAdmin) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(5000); } catch (e) { return { success: false, message: "Server bận" }; }
  
  try {
    const ss = getDatabase();
    const sheet = ss.getSheetByName("WorkLogs");
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    let oldLog = null;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == logId) {
        if (!isAdmin && data[i][1] != userEmail) continue;
        rowIndex = i + 1;
        oldLog = data[i];
        break;
      }
    }
    
    if (rowIndex == -1) return { success: false, message: "Không tìm thấy hoặc không có quyền sửa" };
    
    let dStr = safeDateStr(oldLog[8], "yyyy-MM");
    if (!dStr) dStr = String(oldLog[8]).substring(0, 7);
    
    if (checkIsLocked(dStr)) return { success: false, message: "Tháng này đã khóa sổ!" };
    
    let newQuantity = 0;
    let newJson = {};
    let rawJson = oldLog[4];
    let jsonOnly = rawJson.includes(" [Bonus") ? rawJson.split(" [Bonus")[0] : rawJson;
    try { newJson = JSON.parse(jsonOnly); } catch (e) { newJson = {}; }
    
    if (newData.quantity) newJson.quantity = newData.quantity;
    if (newData.startTime) newJson.startTime = newData.startTime;
    if (newData.endTime) newJson.endTime = newData.endTime;
    
    const taskId = oldLog[2];
    const taskSheet = ss.getSheetByName("Tasks");
    const taskRow = taskSheet.getDataRange().getValues().find(r => r[0] == taskId);
    if (!taskRow) return { success: false, message: "Công việc gốc đã bị xóa" };
    
    const taskUnit = taskRow[3];
    const taskRate = parseFloat(taskRow[4]) || 0;
    
    if (taskUnit === 'Phút') {
      if (!newJson.startTime || !newJson.endTime) return { success: false, message: "Thiếu giờ" };
      const s = new Date("2000-01-01T" + newJson.startTime);
      const e = new Date("2000-01-01T" + newJson.endTime);
      if (e < s) return { success: false, message: "Giờ lỗi" };
      newQuantity = Math.floor((e - s) / 60000);
    } else {
      newQuantity = parseFloat(newJson.quantity) || 0;
    }
    
    let bonusTotal = 0;
    let policy = safeJsonParseServer(safeGet(taskRow, 7, "{}"));
    const ownerEmail = oldLog[1]; 
    const userRow = ss.getSheetByName("Users").getDataRange().getValues().find(r => r[0] == ownerEmail);
    const userTagsStr = (userRow) ? safeGet(userRow, 7, "").toUpperCase() : "";
    
    if (policy.roles && Array.isArray(policy.roles)) {
      policy.roles.forEach(r => {
        if (r.tag && userTagsStr.includes(r.tag.toUpperCase())) bonusTotal += parseFloat(r.amount) || 0;
      });
    }
    
    let fieldsConfig = safeJsonParseServer(taskRow[5]);
    if (Array.isArray(fieldsConfig)) {
      fieldsConfig.forEach(f => {
        if (f.type === 'select' && f.optionsConfig) {
          const k = f.label.toLowerCase().replace(/\s+/g, '_');
          const v = newJson[k];
          if (v) {
            const o = f.optionsConfig.find(opt => opt.value === v);
            if (o && o.bonus) bonusTotal += parseFloat(o.bonus) || 0;
          }
        }
      });
    }
    
    const safeMoney = roundMoney((newQuantity * taskRate) + bonusTotal);
    const editorNote = isAdmin ? " [Admin Edited]" : " [User Edited]";
    
    sheet.getRange(rowIndex, 5).setValue(JSON.stringify(newJson) + editorNote);
    sheet.getRange(rowIndex, 6).setValue(newQuantity);
    sheet.getRange(rowIndex, 7).setValue(safeMoney);
    return { success: true, message: "Cập nhật thành công!" };
    
  } catch (e) { return { success: false, message: e.toString() }; } finally { lock.releaseLock(); }
}

function adminUpdateWorkLog(logId, adminEmail, newData) {
  return processUpdateLog(logId, adminEmail, newData, true);
}

function userUpdateWorkLog(logId, userEmail, newData) {
  return processUpdateLog(logId, userEmail, newData, false);
}

function processDeleteLog(logId, userEmail, isAdmin) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("WorkLogs");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == logId) {
      if (!isAdmin && data[i][1] != userEmail) continue;
      
      let dStr = safeDateStr(data[i][8], "yyyy-MM");
      if (!dStr) dStr = String(data[i][8]).substring(0, 7);
      
      if (checkIsLocked(dStr)) return { success: false, message: "Tháng này đã khóa sổ, không thể xóa!" };
      
      sheet.getRange(i + 1, 10).setValue("Deleted");
      return { success: true, message: "Đã xóa chấm công!" };
    }
  }
  return { success: false, message: "Không thể xóa (Không tìm thấy hoặc đã bị khóa)" };
}

function adminDeleteWorkLog(logId, adminEmail) {
  return processDeleteLog(logId, adminEmail, true);
}

function userDeleteWorkLog(logId, userEmail) {
  return processDeleteLog(logId, userEmail, false);
}

// ======================================================
// 4. DASHBOARD & REPORTING
// ======================================================

function getUserDashboardData(email, monthStr) {
  const ss = getDatabase();
  const timeZone = Session.getScriptTimeZone();
  const todayStr = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd");
  const targetMonthStr = monthStr ? monthStr : todayStr.substring(0, 7);
  
  const targetEmail = String(email).toLowerCase().trim();

  const userRow = ss.getSheetByName("Users").getDataRange().getValues()
                    .find(r => String(r[0]).toLowerCase().trim() == targetEmail);
  
  let userSettings = safeJsonParseServer(userRow ? userRow[5] : "{}");
  let dependents = parseInt(safeGet(userRow, 6, 0)) || 0;
  
  // ÉP KIỂU BẢO VỆ
  let insType = String(userSettings.insuranceType || '').trim();
  
  const sysSheet = ss.getSheetByName("SystemConfig");
  let selfRelief = 11000000;
  let dependentRelief = 4400000;
  
  let bhxhBase = 1760000;
  let bhxhSubsidy = 12216;
  let flatTaxRate = 10;

  if (sysSheet) {
    const sysData = sysSheet.getDataRange().getValues();
    // BẢO VỆ NaN
    const r1 = sysData.find(r => r[0] === "SELF_RELIEF"); if (r1 && !isNaN(parseFloat(r1[1]))) selfRelief = parseFloat(r1[1]);
    const r2 = sysData.find(r => r[0] === "DEPENDENT_RELIEF"); if (r2 && !isNaN(parseFloat(r2[1]))) dependentRelief = parseFloat(r2[1]);
    const r3 = sysData.find(r => r[0] === "BHXH_BASE"); if (r3 && r3[1] !== "" && !isNaN(parseFloat(r3[1]))) bhxhBase = parseFloat(r3[1]);
    const r4 = sysData.find(r => r[0] === "BHXH_SUBSIDY"); if (r4 && r4[1] !== "" && !isNaN(parseFloat(r4[1]))) bhxhSubsidy = parseFloat(r4[1]);
    const r5 = sysData.find(r => r[0] === "FLAT_TAX_RATE"); if (r5 && r5[1] !== "" && !isNaN(parseFloat(r5[1]))) flatTaxRate = parseFloat(r5[1]);
  }
  
  const salaryLevels = ss.getSheetByName("SalaryLevels").getDataRange().getValues();
  let baseSalary = 0;
  if (userSettings.salaryLevelId) {
    const l = salaryLevels.find(r => String(r[0]) === String(userSettings.salaryLevelId));
    if (l) baseSalary = parseFloat(l[2]) || 0;
  }
  
  const deductionLevels = ss.getSheetByName("DeductionLevels").getDataRange().getValues();
  const deductionTypes = ss.getSheetByName("DeductionTypes").getDataRange().getValues();
  const leaveTypes = ss.getSheetByName("LeaveTypes").getDataRange().getValues(); 
  
  let insuranceDeduction = 0;
  let incidentDeduction = 0;
  let deductionDetails = [];
  
  if (userSettings.deductions) {
    for (let typeId in userSettings.deductions) {
      const lId = userSettings.deductions[typeId];
      const lRow = deductionLevels.find(r => String(r[0]) === String(lId));
      const tRow = deductionTypes.find(r => String(r[0]) === String(typeId));
      if (lRow && tRow && tRow[3] !== 'Incident') {
        const amt = parseFloat(lRow[3]) || 0;
        insuranceDeduction += amt;
        deductionDetails.push({ name: tRow[1], amount: amt, isIncident: false, note: "Cố định" });
      }
    }
  }
  
  const incSheet = ss.getSheetByName("IncurredDeductions");
  if (incSheet) {
    const incData = incSheet.getDataRange().getValues();
    for (let i = incData.length - 1; i >= 1; i--) {
      const r = incData[i];
      if (String(r[1]).toLowerCase().trim() == targetEmail) {
        const amt = parseFloat(r[3]) || 0;
        let dStr = safeDateStr(r[5], "yyyy-MM-dd");
        if (dStr.startsWith(targetMonthStr)) {
          incidentDeduction += amt;
          deductionDetails.push({ name: r[2], amount: amt, isIncident: true, note: r[4] });
        }
      }
    }
  }

  const leaveReqSheet = ss.getSheetByName("LeaveRequests");
  if (leaveReqSheet) {
    const lData = leaveReqSheet.getDataRange().getValues();
    for (let i = 1; i < lData.length; i++) {
        const req = lData[i];
        if (String(req[1]).toLowerCase().trim() === targetEmail && req[7] === 'Approved') {
            let dStart = safeDateStr(req[2], "yyyy-MM-dd");
            if (dStart.startsWith(targetMonthStr)) {
                const days = parseFloat(req[4]) || 0;
                const typeId = req[5];
                const lTypeRow = leaveTypes.find(t => String(t[0]) === String(typeId));
                if (lTypeRow) {
                    const mappedIds = safeJsonParseServer(lTypeRow[2]); 
                    mappedIds.forEach(dedLvlId => {
                        const dLvl = deductionLevels.find(d => String(d[0]) === String(dedLvlId));
                        if (dLvl) {
                            const unitAmount = parseFloat(dLvl[3]) || 0;
                            const totalLeaveDed = unitAmount * days; 
                            incidentDeduction += totalLeaveDed;
                            deductionDetails.push({ 
                                name: `Nghỉ: ${lTypeRow[1]} (${days} ngày)`, 
                                amount: totalLeaveDed, 
                                isIncident: true, 
                                note: `Mức trừ: ${formatCurrencyVN(unitAmount)}/ngày` 
                            });
                        }
                    });
                }
            }
        }
    }
  }
  
  let taskUnitMap = {};
  const tasksSheet = ss.getSheetByName("Tasks");
  const taskRows = tasksSheet ? tasksSheet.getDataRange().getValues() : [];
  taskRows.forEach(r => {
      if(r[0]) taskUnitMap[r[0]] = String(r[3]).toLowerCase().trim();
  });

  const logsData = ss.getSheetByName("WorkLogs").getDataRange().getValues();
  let todayIncome = 0;
  let monthProductIncome = 0;
  let lifetimeIncome = 0;
  let totalTeachingPeriods = 0; 
  let historyLogs = [];
  let groupPieData = {}; 
  
  let taskInfoMap = {};
  taskRows.forEach(r => taskInfoMap[r[0]] = r[1]); 
  
  for (let i = logsData.length - 1; i >= 1; i--) {
    const row = logsData[i];
    if (row[9] === "Deleted") continue;
    
    if (String(row[1]).toLowerCase().trim() == targetEmail) {
      const money = parseFloat(row[6]) || 0;
      let dStr = safeDateStr(row[8], "yyyy-MM-dd");
      
      lifetimeIncome += money; 
      
      if (dStr.startsWith(targetMonthStr)) {
        monthProductIncome += money; 
        
        const taskId = row[2];
        const unit = taskUnitMap[taskId] || "";
        if (unit === "tiết" || unit === "tiet") {
            totalTeachingPeriods += parseFloat(row[5]) || 0; 
        }
        
        const gId = taskInfoMap[row[2]];
        const tName = row[3];
        if (gId) {
          if (!groupPieData[gId]) groupPieData[gId] = {}; 
          if (!groupPieData[gId][tName]) groupPieData[gId][tName] = 0;
          groupPieData[gId][tName] += money;
        }
        
        if (historyLogs.length < 50) {
          historyLogs.push({
            id: row[0], taskName: row[3], quantity: row[5], money: money,
            date: dStr, time: safeDateStr(row[7], "HH:mm"), rawInput: row[4],
            adminNote: row[11] || ""
          });
        }
      }
      
      if (dStr == todayStr) todayIncome += money;
    }
  }
  
  let monthBonus = 0;
  const bonusSheet = ss.getSheetByName("Bonuses");
  
  if (bonusSheet) {
      const bonusData = bonusSheet.getDataRange().getValues();
      for (let i = 1; i < bonusData.length; i++) {
          const bEmail = String(bonusData[i][1]).toLowerCase().trim(); 
          if (bEmail === targetEmail) {
              const amount = parseFloat(bonusData[i][2]) || 0;
              let bDate = safeDateStr(bonusData[i][4], "yyyy-MM-dd"); 
              
              lifetimeIncome += amount;
              if (bDate.startsWith(targetMonthStr)) monthBonus += amount;
              if (bDate === todayStr) todayIncome += amount;
          }
      }
  }
  
  // 6. TÍNH THUẾ & THỰC LĨNH ĐỒNG BỘ FULL-TIME & CTV
  let totalIncome = baseSalary + monthProductIncome + monthBonus;

  let taxable = 0;
  let taxAmount = 0;
  let taxDetails = [];
  let isProgressiveTax = false;

  if (insType === '1') {
      // TH 1: ĐÓNG BHXH TẠI SUNNYCARE
      let totalSubsidy = totalTeachingPeriods * bhxhSubsidy;
      let dynamicBhxhDed = Math.round(bhxhBase - totalSubsidy);
      if (dynamicBhxhDed < 0) dynamicBhxhDed = 0; 
      
      insuranceDeduction += dynamicBhxhDed;
      
      // BẢN X-QUANG: Luôn hiển thị để báo cáo (kể cả khi bằng 0đ)
      deductionDetails.push({ 
          name: `BHXH (Hỗ trợ ${totalTeachingPeriods} tiết)`, 
          amount: dynamicBhxhDed, 
          isIncident: false, 
          note: `Gốc: ${bhxhBase}đ - Công ty hỗ trợ: ${totalSubsidy}đ` 
      });
      
      isProgressiveTax = true; 
  } 
  else if (insType === '2') {
      // TH 2: ĐÓNG NƠI KHÁC
      taxable = totalIncome; 
      taxAmount = Math.round(totalIncome * (flatTaxRate / 100));
      if (taxAmount > 0) taxDetails.push({ label: `Thuế khoán ${flatTaxRate}%`, taxable: totalIncome, tax: taxAmount });
  } 
  else if (insType === '3') {
      // TH 3: KHÔNG ĐÓNG BHXH
      taxable = 0; taxAmount = 0;
  }
  else {
      // MẶC ĐỊNH (FULL-TIME)
      if (insuranceDeduction === 0) {
          // BẢN X-QUANG: Báo cho Admin biết người này đang bị rớt vào nhóm Full-time
          deductionDetails.push({ 
              name: "BHXH (Nhóm Full-time)", 
              amount: 0, 
              isIncident: false, 
              note: "Hệ thống chưa ghi nhận TH1. Hãy vào tab Phân bổ lưu lại." 
          });
      }
      isProgressiveTax = true; 
  }

  // Chạy bộ tính thuế Lũy tiến
  if (isProgressiveTax) {
      taxable = totalIncome - insuranceDeduction - incidentDeduction - (selfRelief + (dependents * dependentRelief));
      if (taxable < 0) taxable = 0;
      
      const taxConfigRaw = ss.getSheetByName("TaxConfig").getDataRange().getValues().slice(1);
      const taxConfig = taxConfigRaw
        .filter(r => r[4] !== 'Deleted' && r[0])
        .map(r => ({ min: parseFloat(r[1]), max: parseFloat(r[2]), percent: parseFloat(r[3]) }));
        
      taxConfig.sort((a, b) => a.min - b.min);
      
      if (taxable > 0) {
          for (let i = 0; i < taxConfig.length; i++) {
            const tier = taxConfig[i];
            let amtInTier = 0;
            if (taxable > tier.min) {
                if (taxable >= tier.max) amtInTier = tier.max - tier.min;
                else amtInTier = taxable - tier.min;
            }
            if (amtInTier > 0) {
                const tVal = amtInTier * (tier.percent / 100);
                taxAmount += tVal;
                taxDetails.push({ label: `Bậc ${tier.percent}%`, taxable: amtInTier, tax: tVal });
            }
          }
          taxAmount = Math.round(taxAmount);
      }
  }

  // Chốt lương Thực lĩnh
  const netIncome = Math.round(totalIncome - (insuranceDeduction + incidentDeduction) - taxAmount);
  
  return {
    todayIncome, monthProductIncome, bonus: monthBonus, 
    baseSalary, totalDeduction: insuranceDeduction + incidentDeduction,
    insuranceDeduction, incidentDeduction,
    taxData: { taxableIncome: taxable, selfRelief, dependentRelief, dependentsCount: dependents, taxAmount: taxAmount, details: taxDetails },
    estimatedMonthTotal: netIncome, lifetimeIncome, deductionDetails, historyLogs, groupPieData, targetMonth: targetMonthStr
  };
}

function calculateProgressiveTax(taxable, taxConfig) {
  if (taxable <= 0) return { taxAmount: 0, details: [] };
  taxConfig.sort((a, b) => a.min - b.min);
  let taxAmount = 0;
  let details = [];
  for (let i = 0; i < taxConfig.length; i++) {
    const tier = taxConfig[i];
    let range = tier.max - tier.min;
    if (tier.max > 9000000000) range = taxable;
    let amtInTier = 0;
    if (taxable > tier.min) {
      if (taxable >= tier.max) amtInTier = tier.max - tier.min;
      else amtInTier = taxable - tier.min;
    }
    if (amtInTier > 0) {
      const t = amtInTier * (tier.percent / 100);
      taxAmount += t;
      details.push({ label: `Bậc ${tier.percent}%`, taxable: amtInTier, tax: t });
    }
  }
  return { taxAmount, details };
}



// ------------------------------------------------------
// MODULE REPORTING (SNAPSHOT + CALCULATION)
// ------------------------------------------------------

function getCompanyPayrollData(monthStr, forceRecalculate) {
  const ss = getDatabase();
  let individualApprovedList = []; 

  const statusSheet = ss.getSheetByName("PayrollStatus");
  const statusData = statusSheet ? statusSheet.getDataRange().getValues() : [];
  let statusRowIndex = -1;
  let currentStatus = "Pending";
  let paidList = [];
  
  const statusRow = statusData.find((r, i) => {
    let rStr = safeDateStr(r[0], "yyyy-MM");
    if (!rStr) rStr = String(r[0]);
    rStr = rStr.replace("'", "");
    if (rStr === monthStr) { statusRowIndex = i; return true; }
    return false;
  });
  
  if (statusRow) {
    currentStatus = statusRow[1] || "Pending";
    if (statusRow[4]) { try { paidList = JSON.parse(statusRow[4]); } catch (e) {} }
    if (statusRow.length > 7 && statusRow[7]) { try { individualApprovedList = JSON.parse(statusRow[7]); } catch(e) {} }
    if (statusRow.length > 6 && statusRow[6] && !forceRecalculate && currentStatus === 'Approved') {
        try { return { report: JSON.parse(statusRow[6]), status: currentStatus, paidCount: paidList.length }; } catch(e) {}
    }
  }

  const logsSheet = ss.getSheetByName("WorkLogs");
  const incSheet = ss.getSheetByName("IncurredDeductions");
  const bonusSheet = ss.getSheetByName("Bonuses"); 
  const tasksSheet = ss.getSheetByName("Tasks"); 

  const logsData = logsSheet.getDataRange().getValues();
  const incData = incSheet ? incSheet.getDataRange().getValues() : [];
  const bonusData = bonusSheet ? bonusSheet.getDataRange().getValues() : [];
  const tasksData = tasksSheet ? tasksSheet.getDataRange().getValues() : []; 
  
  let hasData = false;
  for (let i = 1; i < logsData.length; i++) {
    if (logsData[i][9] !== "Deleted") {
      let dStr = safeDateStr(logsData[i][8], "yyyy-MM-dd");
      if (dStr.startsWith(monthStr)) { hasData = true; break; }
    }
  }
  if (!hasData && incData.length > 1) {
    for (let i = 1; i < incData.length; i++) {
      let dStr = safeDateStr(incData[i][5], "yyyy-MM-dd");
      if (dStr.startsWith(monthStr)) { hasData = true; break; }
    }
  }
  if (!hasData && bonusData.length > 1) {
    for (let i = 1; i < bonusData.length; i++) {
      let dStr = safeDateStr(bonusData[i][4], "yyyy-MM-dd");
      if (dStr.startsWith(monthStr)) { hasData = true; break; }
    }
  }
  
  if (!hasData) return { report: [], status: "Pending", paidCount: 0 };

  const users = ss.getSheetByName("Users").getDataRange().getValues().slice(1);
  const salaryLevels = ss.getSheetByName("SalaryLevels").getDataRange().getValues();
  const dedLevels = ss.getSheetByName("DeductionLevels").getDataRange().getValues();
  const dedTypes = ss.getSheetByName("DeductionTypes").getDataRange().getValues();
  const leaveTypes = ss.getSheetByName("LeaveTypes").getDataRange().getValues();
  
  const taxConfig = ss.getSheetByName("TaxConfig").getDataRange().getValues().slice(1)
    .filter(r => r[4] !== 'Deleted' && r[0])
    .map(r => ({ min: parseFloat(r[1]), max: parseFloat(r[2]), percent: parseFloat(r[3]) }));
    
  let selfRelief = 11000000;
  let dependentRelief = 4400000;
  let bhxhBase = 1760000; 
  let bhxhSubsidy = 12216; 
  let flatTaxRate = 10;

  const sysConfig = ss.getSheetByName("SystemConfig").getDataRange().getValues();
  
  // LỚP BẢO VỆ DỮ LIỆU: Chỉ nhận số hợp lệ (!isNaN), nếu lỗi tự quay về mặc định
  const r1 = sysConfig.find(r => r[0] === "SELF_RELIEF"); if (r1 && !isNaN(parseFloat(r1[1]))) selfRelief = parseFloat(r1[1]);
  const r2 = sysConfig.find(r => r[0] === "DEPENDENT_RELIEF"); if (r2 && !isNaN(parseFloat(r2[1]))) dependentRelief = parseFloat(r2[1]);
  const r3 = sysConfig.find(r => r[0] === "BHXH_BASE"); if (r3 && r3[1] !== "" && !isNaN(parseFloat(r3[1]))) bhxhBase = parseFloat(r3[1]);
  const r4 = sysConfig.find(r => r[0] === "BHXH_SUBSIDY"); if (r4 && r4[1] !== "" && !isNaN(parseFloat(r4[1]))) bhxhSubsidy = parseFloat(r4[1]);
  const r5 = sysConfig.find(r => r[0] === "FLAT_TAX_RATE"); if (r5 && r5[1] !== "" && !isNaN(parseFloat(r5[1]))) flatTaxRate = parseFloat(r5[1]);
  
  const leaveRequestsSheet = ss.getSheetByName("LeaveRequests");
  const leaveData = leaveRequestsSheet ? leaveRequestsSheet.getDataRange().getValues() : [];

  let taskUnitMap = {};
  for(let i = 1; i < tasksData.length; i++) {
      if(tasksData[i][0]) taskUnitMap[tasksData[i][0]] = String(tasksData[i][3]).toLowerCase().trim(); 
  }

  let payrollReport = [];
  
  users.forEach(uRow => {
    if (!uRow[0]) return;
    const email = uRow[0];
    const name = uRow[3];
    const dependents = parseInt(safeGet(uRow, 6, 0)) || 0;
    
    const bankName = safeGet(uRow, 13, "");
    const bankAccount = safeGet(uRow, 14, "");
    const bankBeneficiary = safeGet(uRow, 15, "");

    let userSettings = safeJsonParseServer(safeGet(uRow, 5, "{}"));
    
    // LỚP BẢO VỆ KIỂU DỮ LIỆU: Ép về String để so sánh chuẩn xác
    let insType = String(userSettings.insuranceType || '').trim(); 
    
    let baseSalary = 0;
    if (userSettings.salaryLevelId) {
      const sl = salaryLevels.find(r => String(r[0]) === String(userSettings.salaryLevelId));
      if (sl) baseSalary = parseFloat(sl[2]) || 0;
    }
    
    let insuranceDed = 0;
    if (userSettings.deductions) {
      for (let typeId in userSettings.deductions) {
        const lId = userSettings.deductions[typeId];
        const lRow = dedLevels.find(r => String(r[0]) === String(lId));
        const tRow = dedTypes.find(r => String(r[0]) === String(typeId));
        if (lRow && tRow && tRow[3] !== 'Incident') insuranceDed += parseFloat(lRow[3]) || 0;
      }
    }
    
    let productIncome = 0;
    let totalTeachingPeriods = 0; 
    for (let i = 1; i < logsData.length; i++) {
      const log = logsData[i];
      if (log[9] === "Deleted") continue;
      if (log[1] === email) {
        let dStr = safeDateStr(log[8], "yyyy-MM-dd");
        if (dStr.startsWith(monthStr)) {
            productIncome += parseFloat(log[6]) || 0;
            const taskId = log[2];
            const unit = taskUnitMap[taskId] || "";
            if (unit === "tiết" || unit === "tiet") totalTeachingPeriods += parseFloat(log[5]) || 0; 
        }
      }
    }

    let bonus = 0;
    const targetEmail = String(email).toLowerCase().trim();
    for (let i = 1; i < bonusData.length; i++) {
      const bRow = bonusData[i];
      const rowEmail = String(bRow[1]).toLowerCase().trim();
      if (rowEmail === targetEmail) {
        let dStr = safeDateStr(bRow[4], "yyyy-MM-dd");
        if (dStr.startsWith(monthStr)) bonus += parseFloat(bRow[2]) || 0;
      }
    }
    
    let incidentDed = 0;
    for (let i = 1; i < incData.length; i++) {
      const inc = incData[i];
      if (inc[1] === email) {
        let dStr = safeDateStr(inc[5], "yyyy-MM-dd");
        if (dStr.startsWith(monthStr)) incidentDed += parseFloat(inc[3]) || 0;
      }
    }
    
    let leaveDays = 0;
    for (let i = 1; i < leaveData.length; i++) {
      const req = leaveData[i];
      if (req[1] === email && req[7] === "Approved") {
        let dStart = safeDateStr(req[2], "yyyy-MM-dd");
        if (dStart.startsWith(monthStr)) {
          const days = parseFloat(req[4]) || 0;
          leaveDays += days;
          const typeId = req[5];
          const lTypeRow = leaveTypes.find(t => String(t[0]) === String(typeId));
          if (lTypeRow) {
             const mappedIds = safeJsonParseServer(lTypeRow[2]);
             mappedIds.forEach(dedLvlId => {
                 const dLvl = dedLevels.find(d => String(d[0]) === String(dedLvlId));
                 if (dLvl) incidentDed += (parseFloat(dLvl[3]) || 0) * days;
             });
          }
        }
      }
    }
    
    const totalIncome = baseSalary + productIncome + bonus;
    let taxAmount = 0;
    let isProgressiveTax = false; 

    if (insType === '1') {
        let totalSubsidy = totalTeachingPeriods * bhxhSubsidy;
        let dynamicBhxhDed = bhxhBase - totalSubsidy;
        if (dynamicBhxhDed < 0) dynamicBhxhDed = 0; 
        insuranceDed += dynamicBhxhDed; 
        isProgressiveTax = true; 
    } 
    else if (insType === '2') {
        taxAmount = totalIncome * (flatTaxRate / 100);
    } 
    else if (insType === '3') {
        taxAmount = 0;
    }
    else {
        isProgressiveTax = true; 
    }

    if (isProgressiveTax) {
        let taxable = totalIncome - insuranceDed - incidentDed - (selfRelief + (dependents * dependentRelief));
        if (taxable < 0) taxable = 0;
        
        taxConfig.sort((a, b) => a.min - b.min);
        for (let i = 0; i < taxConfig.length; i++) {
          const tier = taxConfig[i];
          let range = tier.max - tier.min;
          if (tier.max > 9000000000) range = taxable;
          let amtInTier = 0;
          if (taxable > tier.min) {
            if (taxable >= tier.max) amtInTier = tier.max - tier.min;
            else amtInTier = taxable - tier.min;
          }
          if (amtInTier > 0) taxAmount += amtInTier * (tier.percent / 100);
        }
    }

    insuranceDed = Math.round(insuranceDed);
    incidentDed = Math.round(incidentDed);
    taxAmount = Math.round(taxAmount);

    const totalDed = insuranceDed + incidentDed;
    const netIncome = Math.round(totalIncome - totalDed - taxAmount);
    
    const isPaid = paidList.includes(email);
    const isApproved = (currentStatus === 'Approved') || (individualApprovedList && individualApprovedList.includes(email));
    
    if (baseSalary > 0 || productIncome > 0 || incidentDed > 0 || bonus > 0) {
      payrollReport.push({
        email, name, baseSalary, productIncome, bonus, totalIncome,
        fixedDed: insuranceDed, incidentDed, tax: taxAmount,
        netIncome, leaveDays, isPaid, isApproved,
        bankName, bankAccount, bankBeneficiary 
      });
    }
  });
  
  return { report: payrollReport, status: currentStatus, paidCount: paidList.length };
}

function exportPayrollToSheet(monthStr) {
  const dataObj = getCompanyPayrollData(monthStr);
  const data = dataObj.report;
  if (!data || data.length === 0) return { success: false, message: "Không có dữ liệu" };
  
  const fileName = "HRM_BaoCao_" + monthStr.replace("-", "_") + "_" + new Date().getTime();
  const newSS = SpreadsheetApp.create(fileName);
  const sheet = newSS.getActiveSheet();
  
  sheet.appendRow(["Mã NV", "Họ Tên", "Ngày Nghỉ", "Lương Cứng", "Lương SP", "Tổng Thu Nhập", "Trừ Cố định", "Trừ Sự vụ", "Thuế TNCN", "THỰC LĨNH"]);
  sheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#e0f7fa");
  
  const rows = data.map(d => [d.email, d.name, d.leaveDays, d.baseSalary, d.productIncome, d.totalIncome, d.fixedDed, d.incidentDed, d.tax, d.netIncome]);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 10).setValues(rows);
    sheet.getRange(2, 4, rows.length, 7).setNumberFormat("#,##0");
  }
  return { success: true, message: "Đã xuất ra file riêng!", url: newSS.getUrl() };
}

// ======================================================
// 5. CRUD & MASTER DATA (QUẢN LÝ DỮ LIỆU)
// ======================================================

function genericSave(sheetName, id, values, prefix) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName(sheetName);
  
  if (id) {
    const data = sheet.getDataRange().getValues();
    for (let j = 1; j < data.length; j++) {
      if (data[j][0] == id) {
        sheet.getRange(j + 1, 2, 1, values.length).setValues([values]);
        return { success: true, message: "Đã cập nhật!" };
      }
    }
  } else {
    const newId = prefix + new Date().getTime();
    sheet.appendRow([newId, ...values]);
    return { success: true, message: "Đã tạo mới!" };
  }
}

function genericDelete(sheetName, id, statusColIndex) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  
  for (let j = 1; j < data.length; j++) {
    if (data[j][0] == id) {
      sheet.getRange(j + 1, statusColIndex + 1).setValue("Deleted");
      return { success: true };
    }
  }
  return { success: false, message: "Không tìm thấy" };
}

function saveTaskGroup(id, name, desc) {
  return genericSave("TaskGroups", id, [name, desc, "Active"], "GRP_");
}

function deleteTaskGroup(id) {
  return genericDelete("TaskGroups", id, 3);
}

function saveTaskConfig(id, groupId, name, unit, rate, fields, policy) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("Tasks");
  if (id) {
    const data = sheet.getDataRange().getValues();
    for (let j = 1; j < data.length; j++) {
      if (data[j][0] == id) {
        sheet.getRange(j + 1, 2).setValue(groupId);
        sheet.getRange(j + 1, 3).setValue(name);
        sheet.getRange(j + 1, 4).setValue(unit);
        sheet.getRange(j + 1, 5).setValue(rate);
        sheet.getRange(j + 1, 6).setValue(fields);
        sheet.getRange(j + 1, 8).setValue(policy);
        return { success: true };
      }
    }
  } else {
    sheet.appendRow(["TSK_" + new Date().getTime(), groupId, name, unit, rate, fields, "Active", policy]);
    return { success: true };
  }
}

function deleteTask(id) {
  return genericDelete("Tasks", id, 6);
}

function saveSalaryLevel(id, name, amount) {
  return genericSave("SalaryLevels", id, [name, amount, "Active"], "SAL_");
}

function deleteSalaryLevel(id) {
  return genericDelete("SalaryLevels", id, 3);
}

function saveDeductionType(id, name, desc, freq) {
  return genericSave("DeductionTypes", id, [name, desc, freq, "Active"], "DED_TYPE_");
}

function deleteDeductionType(id) {
  return genericDelete("DeductionTypes", id, 4);
}

function saveDeductionLevel(id, typeId, name, amount) {
  return genericSave("DeductionLevels", id, [typeId, name, amount, "Active"], "DED_LVL_");
}

function deleteDeductionLevel(id) {
  return genericDelete("DeductionLevels", id, 4);
}

function saveTaxConfig(id, min, max, percent) {
  return genericSave("TaxConfig", id, [min, max, percent, "Active"], "TAX_");
}

function deleteTaxConfig(id) {
  return genericDelete("TaxConfig", id, 4);
}

function saveLeaveType(id, name, mapping) {
  return genericSave("LeaveTypes", id, [name, mapping, "Active"], "LEAVE_TYPE_");
}

function deleteLeaveType(id) {
  return genericDelete("LeaveTypes", id, 3);
}

function saveSystemConfig(cfg) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("SystemConfig");
  
  // Giữ nguyên hàm cập nhật dòng cũ của bạn
  const updateRow = (key, val) => {
    const data = sheet.getDataRange().getValues();
    let found = false;
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(val);
        found = true;
        break;
      }
    }
    if (!found) sheet.appendRow([key, val]);
  };
  
  // 1. Giữ nguyên toàn bộ 6 tham số cũ (Lấy từ gói cfg)
  updateRow("SELF_RELIEF", cfg.selfRelief);
  updateRow("DEPENDENT_RELIEF", cfg.dependentRelief);
  updateRow("DIRECTOR_EMAIL", cfg.directorEmail);
  updateRow("ACCOUNTANT_EMAIL", cfg.accountantEmail);
  updateRow("TECH_ZALO", cfg.techZalo);
  updateRow("ACC_ZALO", cfg.accZalo);
  
  // 2. [MỚI] Thêm 3 tham số BHXH & Thuế
  updateRow("BHXH_BASE", cfg.bhxhBase);
  updateRow("BHXH_SUBSIDY", cfg.bhxhSubsidy);
  updateRow("FLAT_TAX_RATE", cfg.flatTaxRate);
  
  return { success: true };
}

function saveUserDependents(email, count) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  for (let j = 1; j < data.length; j++) {
    if (data[j][0] == email) {
      sheet.getRange(j + 1, 7).setValue(count);
      return { success: true };
    }
  }
  return { success: false };
}

// User Admin
function adminCreateUser(payload) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == payload.email) return { success: false, message: "Email đã tồn tại!" };
  }
  
  // [CẬP NHẬT] Thêm các trường mới vào mảng appendRow
  // Cấu trúc: Email, Pass, Role, Name, ID, Settings, Dependents, Tags, ContractUrl, StaffCode, WorkType, ContractExpire, AvatarUrl
  sheet.appendRow([
      payload.email, 
      payload.password, 
      payload.role, 
      payload.name, 
      "USR_" + new Date().getTime(), 
      "{}", 
      payload.dependents || 0, // Lưu dependents
      "", 
      "",
      payload.staffCode || "",
      payload.workType || "Fulltime",
      payload.contractExpire || "",
      payload.avatar || "",
      // [MỚI] Thêm 3 cột cuối
      payload.bankName || "",
      payload.bankAccount || "",
      payload.bankBeneficiary || ""
  ]);
  return { success: true, message: "Đã tạo nhân viên mới!" };
}

function adminUpdateUser(email, payload) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == email) {
      // Cập nhật từng cột
      sheet.getRange(i + 1, 2).setValue(payload.password);
      sheet.getRange(i + 1, 3).setValue(payload.role);
      sheet.getRange(i + 1, 4).setValue(payload.name);
      
      // [CẬP NHẬT] Cập nhật các cột mới
      sheet.getRange(i + 1, 7).setValue(payload.dependents); // Cột G: Dependents
      
      // Cột 10 (J): StaffCode
      sheet.getRange(i + 1, 10).setValue(payload.staffCode || "");
      
      // Cột 11 (K): WorkType
      sheet.getRange(i + 1, 11).setValue(payload.workType || "Fulltime");
      
      // Cột 12 (L): ContractExpire
      sheet.getRange(i + 1, 12).setValue(payload.contractExpire || "");
      
      // Cột 13 (M): AvatarUrl (Chỉ update nếu có link mới, tránh ghi đè rỗng nếu user không up ảnh mới)
      if(payload.avatar) {
          sheet.getRange(i + 1, 13).setValue(payload.avatar);
      }
      // [MỚI] Cập nhật thông tin Ngân hàng (Cột 14, 15, 16 -> Index 13, 14, 15)
      // Lưu ý: Trong getRange là index bắt đầu từ 1, nên cột N là 14
      sheet.getRange(i + 1, 14).setValue(payload.bankName || "");
      sheet.getRange(i + 1, 15).setValue(payload.bankAccount || "");
      sheet.getRange(i + 1, 16).setValue(payload.bankBeneficiary || "");
      return { success: true, message: "Đã cập nhật thông tin!" };
    }
  }
  return { success: false, message: "Không tìm thấy user" };
}

function adminDeleteUser(email) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == email) {
      sheet.deleteRow(i + 1);
      return { success: true, message: "Đã xóa nhân viên!" };
    }
  }
  return { success: false, message: "Không tìm thấy" };
}

function batchAssignUsers(emails, config) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  const selectedEmails = Array.isArray(emails) ? emails.map(function(email) {
    return String(email || "").trim().toLowerCase();
  }).filter(Boolean) : [];
  const shouldUpdateTasks = config && config.updateAllowedTasks === true;
  const shouldUpdateDeductions = config && config.updateDeductions === true;
  const shouldUpdateSalary = Boolean(config && config.updateSalaryLevel === true && String(config.salaryLevelId || "").trim());
  const shouldUpdateInsurance = Boolean(config && config.updateInsuranceType === true && String(config.insuranceType || "").trim());
  const changedFields = [];
  if (shouldUpdateTasks) changedFields.push("quyền công việc");
  if (shouldUpdateSalary) changedFields.push("lương cứng");
  if (shouldUpdateDeductions) changedFields.push("khoản trừ cố định");
  if (shouldUpdateInsurance) changedFields.push("chế độ BHXH & thuế");

  if (!selectedEmails.length) return { success: false, message: "Chưa chọn nhân sự." };
  if (!changedFields.length) {
    return { success: false, message: "Chưa chọn nội dung cần cập nhật. Các mục để '-- Không thay đổi --' sẽ được giữ nguyên." };
  }

  let updated = 0;
  
  for (let i = 1; i < data.length; i++) {
    if (selectedEmails.includes(String(data[i][0] || "").trim().toLowerCase())) {
      let settings = {};
      try { settings = JSON.parse(data[i][5]) } catch (e) {}
      const settingsBefore = JSON.stringify(settings);
      
      // Mỗi nhóm cấu hình được cập nhật độc lập. Tuyệt đối không ghi đè
      // quyền việc, đơn giá/bậc lương hoặc khoản trừ khi quản trị viên chưa
      // chủ động chọn nhóm đó trên giao diện.
      if (shouldUpdateTasks) {
        settings.allowedTasks = Array.isArray(config.allowedTasks) ? config.allowedTasks.filter(Boolean) : [];
      }
      if (shouldUpdateSalary) settings.salaryLevelId = String(config.salaryLevelId).trim();
      if (shouldUpdateDeductions) settings.deductions = config.deductionAssignments || {};
      if (shouldUpdateInsurance) settings.insuranceType = String(config.insuranceType).trim();
      
      sheet.getRange(i + 1, 6).setValue(JSON.stringify(settings));
      appendUserConfigAudit_(ss, {
        userEmail: data[i][0],
        changedFields: changedFields,
        beforeJson: settingsBefore,
        afterJson: JSON.stringify(settings),
        actorEmail: config && config.actorEmail
      });
      updated++;
    }
  }
  
  return { success: true, updated: updated, changedFields: changedFields, message: "Đã cập nhật " + changedFields.join(", ") + " cho " + updated + " nhân sự; các cấu hình khác được giữ nguyên." };
}

function appendUserConfigAudit_(ss, entry) {
  const headers = ["Timestamp", "UserEmail", "ChangedFields", "BeforeJson", "AfterJson", "ActorEmail"];
  let sheet = ss.getSheetByName("UserConfigAudit");
  if (!sheet) sheet = ss.insertSheet("UserConfigAudit");
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  sheet.appendRow([
    new Date(),
    String(entry.userEmail || "").trim().toLowerCase(),
    (entry.changedFields || []).join(", "),
    entry.beforeJson || "{}",
    entry.afterJson || "{}",
    String(entry.actorEmail || "SYSTEM").trim() || "SYSTEM"
  ]);
}

// ======================================================
// 6. SYSTEM AUTOMATION (HỆ THỐNG & BACKUP)
// ======================================================

function initializeSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  // [CẬP NHẬT] Schema: Giữ nguyên cột cũ, chỉ nối thêm cột mới vào sau cùng
  const schema = {
    // Thêm: StaffCode, WorkType, ContractExpire, AvatarUrl vào cuối
    "Users": ["Email", "Password", "Role", "Name", "ID", "Settings", "Dependents", "Tags", "ContractUrl", "StaffCode", "WorkType", "ContractExpire", "AvatarUrl"],
    
    "TaskGroups": ["ID", "Name", "Description", "Status"],
    "Tasks": ["ID", "GroupId", "Name", "Unit", "Rate", "FieldsConfig", "Status", "PolicyJson"],
    "WorkLogs": ["ID", "UserEmail", "TaskId", "TaskName", "InputData", "Quantity", "Money", "Timestamp", "Date", "Status"],
    "SalaryLevels": ["ID", "Name", "Amount", "Status"],
    "DeductionTypes": ["ID", "Name", "Description", "Frequency", "Status"],
    "DeductionLevels": ["ID", "TypeId", "Name", "Amount", "Status"],
    "TaxConfig": ["ID", "Min", "Max", "Percent", "Status"],
    "LeaveTypes": ["ID", "Name", "MappedDeductions", "Status"],
    "LeaveRequests": ["ID", "UserEmail", "StartDate", "EndDate", "Days", "TypeId", "Reason", "Status", "CreatedAt"],
    "IncurredDeductions": ["ID", "UserEmail", "Name", "Amount", "Note", "Date", "RefId"],
    "Notifications": ["ID", "Title", "Content", "Type", "Date", "Author"],
        
    // Thêm: SnapshotData vào cuối (để phục vụ tính năng lưu bản sao lương khi duyệt)
    "PayrollStatus": ["Month", "Status", "ApprovedBy", "ApprovedAt", "PaidList", "Note", "SnapshotData"],
    
    "Notifications": ["ID", "Title", "Content", "Type", "Date", "Author"],
    "SystemConfig": ["Key", "Value"],
    "Bonuses": ["ID", "UserEmail", "Amount", "Reason", "Date", "GivenBy", "IsRead"]
  };

  let createdCount = 0;
  let updatedCount = 0;

  for (let sheetName in schema) {
    let sheet = ss.getSheetByName(sheetName);
    
    // CASE 1: Sheet chưa tồn tại -> Tạo mới (Code gốc của bạn)
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(schema[sheetName]);
      sheet.getRange(1, 1, 1, schema[sheetName].length).setFontWeight("bold").setBackground("#e3f2fd");
      createdCount++;
    } 
    // CASE 2 [MỚI]: Sheet đã tồn tại -> Kiểm tra xem có thiếu cột mới không?
    else {
      const lastCol = sheet.getLastColumn();
      // Nếu số cột hiện tại ít hơn số cột trong schema mới
      if (lastCol < schema[sheetName].length) {
         const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
         const neededHeaders = schema[sheetName];
         
         // Lấy ra các cột còn thiếu
         const missingCols = neededHeaders.slice(currentHeaders.length);
         
         if (missingCols.length > 0) {
            // Điền thêm tiêu đề cột vào bên phải
            sheet.getRange(1, lastCol + 1, 1, missingCols.length)
                 .setValues([missingCols])
                 .setFontWeight("bold")
                 .setBackground("#e3f2fd");
            updatedCount++;
         }
      }
    }
  }

  // --- PHẦN CODE GỐC (GIỮ NGUYÊN) ---
  const configSheet = ss.getSheetByName("SystemConfig");
  if (configSheet.getLastRow() <= 1) {
    const defaults = [
      ["SELF_RELIEF", "11000000"],
      ["DEPENDENT_RELIEF", "4400000"],
      ["DIRECTOR_EMAIL", Session.getActiveUser().getEmail()],
      ["ACCOUNTANT_EMAIL", Session.getActiveUser().getEmail()],
      ["BACKUP_FILE_ID", ""],
      ["FOLDER_CONTRACTS", ""],
      ["FOLDER_PAYSLIPS", ""],
      ["FOLDER_BACKUPS", ""]
    ];
    const existing = configSheet.getDataRange().getValues().map(r => r[0]);
    defaults.forEach(d => {
      if (!existing.includes(d[0])) configSheet.appendRow(d);
    });
  }

  setupDriveFolders();
  setupAutoTrigger();
  // ----------------------------------

  // [MỚI] Cài đặt trigger quét hợp đồng hết hạn
  if (typeof setupContractTrigger === 'function') {
      setupContractTrigger();
  }

  // Thông báo kết quả
  let msg = `Đã khởi tạo hệ thống thành công.`;
  if (updatedCount > 0) msg += `\nĐã cập nhật thêm cột mới cho ${updatedCount} bảng.`;
  
  ui.alert("✅ HOÀN TẤT!", msg, ui.ButtonSet.OK);
}

function setupDriveFolders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName("SystemConfig");
  const configData = configSheet.getDataRange().getValues();
  
  const getOrCreateFolder = (parent, name) => {
    const folders = parent.getFoldersByName(name);
    if (folders.hasNext()) return folders.next();
    return parent.createFolder(name);
  };

  const dbFile = DriveApp.getFileById(ss.getId());
  const parents = dbFile.getParents();
  const parentFolder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  
  const rootFolder = getOrCreateFolder(parentFolder, "HRM_System_Data");
  const backupFolder = getOrCreateFolder(rootFolder, "Backups");
  const contractFolder = getOrCreateFolder(rootFolder, "Contracts");
  const payslipFolder = getOrCreateFolder(rootFolder, "Payslips");

  const updateConfig = (key, val) => {
    for (let i = 0; i < configData.length; i++) {
      if (configData[i][0] === key) {
        configSheet.getRange(i + 1, 2).setValue(val);
        return;
      }
    }
    configSheet.appendRow([key, val]);
  };

  updateConfig("FOLDER_BACKUPS", backupFolder.getId());
  updateConfig("FOLDER_CONTRACTS", contractFolder.getId());
  updateConfig("FOLDER_PAYSLIPS", payslipFolder.getId());
  
  return {
    backup: backupFolder.getId(),
    contract: contractFolder.getId(),
    payslip: payslipFolder.getId()
  };
}

function runSystemBackup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName("SystemConfig");
  const data = configSheet.getDataRange().getValues();
  
  let backupId = "";
  let backupRowIndex = -1;
  
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === "BACKUP_FILE_ID") {
      backupId = data[i][1];
      backupRowIndex = i + 1;
      break;
    }
  }
  
  let backupSS;
  
  if (!backupId || backupId === "") {
    const r = data.find(row => row[0] === "FOLDER_BACKUPS");
    let folderId = r ? r[1] : setupDriveFolders().backup;
    
    const folder = DriveApp.getFolderById(folderId);
    const newFile = SpreadsheetApp.create("HRM_Database_Analytic_Mirror");
    const file = DriveApp.getFileById(newFile.getId());
    file.moveTo(folder);
    
    backupId = newFile.getId();
    
    if (backupRowIndex > 0) configSheet.getRange(backupRowIndex, 2).setValue(backupId);
    else configSheet.appendRow(["BACKUP_FILE_ID", backupId]);
    
    backupSS = newFile;
  } else {
    try {
      backupSS = SpreadsheetApp.openById(backupId);
    } catch(e) {
      configSheet.getRange(backupRowIndex, 2).setValue("");
      return runSystemBackup();
    }
  }
  
  const flattenConfig = {
    "WorkLogs": 4, 
    "Users": 5,    
    "Tasks": 5     
  };

  const sourceSheets = ss.getSheets();
  
  sourceSheets.forEach(sheet => {
    const sheetName = sheet.getName();
    if (sheetName.startsWith("Copy of") || sheetName === "SystemConfig") return;
    
    const sourceData = sheet.getDataRange().getValues();
    
    let targetSheet = backupSS.getSheetByName(sheetName);
    if (!targetSheet) {
      targetSheet = backupSS.insertSheet(sheetName);
    }
    
    targetSheet.clear();
    
    if (sourceData.length === 0) return;

    const originalHeader = sourceData[0];
    const rows = (sourceData.length > 1) ? sourceData.slice(1) : []; 
    
    if (flattenConfig.hasOwnProperty(sheetName)) {
      const jsonColIdx = flattenConfig[sheetName];
      let dynamicKeys = new Set();
      
      rows.forEach(row => {
        try {
          const jsonVal = row[jsonColIdx];
          const obj = JSON.parse(jsonVal);
          if (obj && typeof obj === 'object') {
            Object.keys(obj).forEach(k => dynamicKeys.add(k));
          }
        } catch(e) {}
      });
      
      const extendedHeaders = Array.from(dynamicKeys).sort();
      const newHeader = [...originalHeader, ...extendedHeaders];
      
      const newRows = rows.map(row => {
        let extraValues = new Array(extendedHeaders.length).fill("");
        try {
          const jsonVal = row[jsonColIdx];
          const obj = JSON.parse(jsonVal);
          extendedHeaders.forEach((key, idx) => {
            if (obj && obj[key] !== undefined) extraValues[idx] = obj[key];
          });
        } catch(e) {}
        return [...row, ...extraValues];
      });
      
      targetSheet.getRange(1, 1, 1, newHeader.length).setValues([newHeader])
        .setFontWeight("bold")
        .setBackground("#fff2cc")
        .setBorder(true, true, true, true, true, true);
        
      if (newRows.length > 0) {
        targetSheet.getRange(2, 1, newRows.length, newRows[0].length).setValues(newRows);
      }
      
    } else {
      targetSheet.getRange(1, 1, 1, originalHeader.length).setValues([originalHeader])
        .setFontWeight("bold")
        .setBackground("#fff2cc")
        .setBorder(true, true, true, true, true, true);
        
      if (rows.length > 0) {
        targetSheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      }
    }
  });
  
  SpreadsheetApp.flush();
  console.log("Backup Complete: " + new Date());
}

function setupAutoTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let exists = false;
  
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runSystemBackup') {
      exists = true;
      break;
    }
  }
  
  if (!exists) {
    ScriptApp.newTrigger('runSystemBackup')
      .timeBased()
      .everyDays(1)
      .atHour(1)
      .create();
  }
}

// ======================================================
// 7. INTEGRATED UTILS (UPLOAD & EMAIL - VỚI FOLDER)
// ======================================================

function uploadUserContract(fileData) {
  try {
    const ss = getDatabase();
    const configSheet = ss.getSheetByName("SystemConfig");
    const r = configSheet.getDataRange().getValues().find(row => row[0] === "FOLDER_CONTRACTS");
    
    let targetFolder;
    if (r && r[1]) {
      targetFolder = DriveApp.getFolderById(r[1]);
    } else {
      const ids = setupDriveFolders();
      targetFolder = DriveApp.getFolderById(ids.contract);
    }

    const blob = Utilities.newBlob(Utilities.base64Decode(fileData.data), fileData.mimeType, fileData.name);
    const file = targetFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileUrl = file.getUrl();
    const sheet = ss.getSheetByName("Users");
    const data = sheet.getDataRange().getValues();
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == fileData.userEmail) {
        sheet.getRange(i + 1, 9).setValue(fileUrl);
        found = true;
        break;
      }
    }

    if (!found) return { success: false, message: "Không tìm thấy user để gán hợp đồng" };

    return { success: true, message: "Đã upload hợp đồng thành công!", url: fileUrl };

  } catch (e) {
    return { success: false, message: "Lỗi upload: " + e.toString() };
  }
}

function renderEmailBody(data) {
  // Định nghĩa bộ font an toàn: Ưu tiên Quicksand -> sau đó đến Arial
  const fontStyle = "font-family: 'Quicksand', 'Segoe UI', Arial, sans-serif;";
  
  const html = `
    <div style="background-color: #f4f4f4; padding: 20px; ${fontStyle}">
      
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
          
          <div style="background-color: #1992b0; padding: 20px; text-align: center; color: white;">
              <h2 style="margin: 0; font-size: 24px; text-transform: uppercase; ${fontStyle}">${data.title}</h2>
          </div>

          <div style="padding: 30px; color: #333333; line-height: 1.6; font-size: 16px;">
              <h3 style="color: #1992b0; margin-top: 0; ${fontStyle}">Xin chào ${data.name},</h3>
              
              <p>${data.intro_line}</p>
              
              <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                   ${data.message_content}
              </div>

              <p style="font-size: 0.9em; color: #666;">${data.closing_note}</p>

              ${data.action_url ? `
              <div style="text-align: center; margin-top: 30px;">
                  <a href="${data.action_url}" style="background-color: #1992b0; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; ${fontStyle}">${data.action_text}</a>
              </div>` : ''}
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; ${fontStyle}">
              &copy; 2024 SUNNYCARE - HRM PRO SYSTEM<br>
              Hệ thống quản trị nhân sự tự động.
          </div>
      </div>
    </div>
  `;
  return html;
}

function sendPayslipEmail(monthStr, targetEmail) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: "Server bận, vui lòng thử lại sau." };
  }
  
  try {
    // 1. LẤY DỮ LIỆU & KIỂM TRA (Giữ nguyên)
    const dataObj = getCompanyPayrollData(monthStr);
    const report = dataObj.report;
    const userReport = report.find(r => r.email === targetEmail);
    
    if (!userReport) return { success: false, message: "Không tìm thấy dữ liệu lương" };
    if (userReport.isPaid) return { success: false, message: "Nhân sự này đã được gửi lương rồi!" };
    
    userReport.month = monthStr;

    // 2. TẠO PDF (Giữ nguyên)
    const pdfBlob = createPayslipPDF(userReport);
    
    // 3. LƯU DRIVE (Giữ nguyên)
    try {
      const ss = getDatabase();
      const configSheet = ss.getSheetByName("SystemConfig");
      const r = configSheet.getDataRange().getValues().find(row => row[0] === "FOLDER_PAYSLIPS");
      if (r && r[1]) {
        const rootFolder = DriveApp.getFolderById(r[1]);
        const subFolderName = monthStr;
        
        let subFolder;
        const folders = rootFolder.getFoldersByName(subFolderName);
        if (folders.hasNext()) subFolder = folders.next();
        else subFolder = rootFolder.createFolder(subFolderName);
        
        subFolder.createFile(pdfBlob);
      }
    } catch(e) {
      console.log("Lỗi lưu file PDF: " + e);
    }
    
    // 4. [CẬP NHẬT] XỬ LÝ NỘI DUNG EMAIL (Thêm Thưởng nóng)
    let messageHtml = "";

    // -- Logic MỚI: Nếu có thưởng thì hiện hộp thông báo màu vàng --
    if (userReport.bonus && userReport.bonus > 0) {
        messageHtml += `
        <div style="margin-bottom: 20px; padding: 15px; background-color: #fff3cd; border: 1px solid #ffecb5; border-radius: 8px; color: #856404; text-align: center;">
            <div style="font-size: 24px;">🎁</div>
            <strong>CHÚC MỪNG!</strong><br>
            Tháng này bạn nhận được thưởng nóng:<br>
            <span style="font-size: 20px; font-weight: bold; color: #dc3545;">+${formatCurrencyVN(userReport.bonus)}</span>
        </div>`;
    }

    // -- Logic CŨ: Hiện tổng thực lĩnh --
    messageHtml += `Tổng thực lĩnh của bạn là:<br><span style="font-size:24px; font-weight:bold; color:#1992b0;">${formatCurrencyVN(userReport.netIncome)}</span>`;
    
    // Gọi hàm renderEmailBody gốc của bạn với nội dung đã ghép
    const htmlBody = renderEmailBody({
      title: `PHIẾU LƯƠNG THÁNG ${monthStr}`,
      name: userReport.name,
      intro_line: `<strong>SUNNYCARE - METTASOUL</strong> trân trọng cảm ơn sự đồng hành và những đóng góp tích cực của bạn.`,
      message_content: messageHtml, // <--- Đã thay bằng biến messageHtml ở trên
      closing_note: "Chi tiết thu nhập, thưởng và các khoản khấu trừ được thể hiện trong file PDF đính kèm.",
      action_url: "",
      action_text: ""
    });
    
    // 5. GỬI EMAIL (Giữ nguyên)
    MailApp.sendEmail({
      to: targetEmail,
      subject: `[TB] Thông báo Thù lao & Thu nhập tháng ${monthStr} - ${userReport.name}`,
      htmlBody: htmlBody,
      attachments: [pdfBlob]
    });
    
    // 6. CẬP NHẬT TRẠNG THÁI (Giữ nguyên)
    const ss = getDatabase();
    const sheet = ss.getSheetByName("PayrollStatus");
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    let paidList = [];
    
    for (let i = 1; i < data.length; i++) {
      let rStr = safeDateStr(data[i][0], "yyyy-MM");
      if (!rStr) rStr = String(data[i][0]);
      rStr = rStr.replace("'", "");
      if (rStr === monthStr) {
        rowIndex = i + 1;
        if (data[i][4]) paidList = safeJsonParseServer(data[i][4]);
        break;
      }
    }
    
    if (!paidList.includes(targetEmail)) paidList.push(targetEmail);
    
    if (rowIndex === -1) {
      sheet.appendRow(["'" + monthStr, "Approved", "", "", JSON.stringify(paidList), ""]);
    } else {
      sheet.getRange(rowIndex, 5).setValue(JSON.stringify(paidList));
    }
    return { success: true, message: "Đã gửi mail thành công!" };
    
  } catch (e) {
    return { success: false, message: "Lỗi gửi mail: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// [UPDATED] Hàm lưu trạng thái lương (Thêm Snapshot)
function setPayrollStatus(monthStr, newStatus, userEmail) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("PayrollStatus");
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;
  
  for (let i = 1; i < data.length; i++) {
    let rStr = safeDateStr(data[i][0], "yyyy-MM");
    if (!rStr) rStr = String(data[i][0]);
    rStr = rStr.replace("'", "");
    if (rStr === monthStr) {
      rowIndex = i + 1;
      break;
    }
  }
  
  // 1. TẠO SNAPSHOT (NẾU DUYỆT)
  let snapshotJson = "";
  if (newStatus === 'Approved') {
      // Force tính toán lại để lấy số liệu mới nhất
      const dataObj = getCompanyPayrollData(monthStr, true);
      snapshotJson = JSON.stringify(dataObj.report);
  }
  
  if (rowIndex === -1) {
    // Thêm cột 7 (G) chứa Snapshot
    sheet.appendRow(["'" + monthStr, newStatus, userEmail, new Date(), "[]", "", snapshotJson]);
  } else {
    sheet.getRange(rowIndex, 2).setValue(newStatus);
    sheet.getRange(rowIndex, 3).setValue(userEmail);
    sheet.getRange(rowIndex, 4).setValue(new Date());
    // Ghi đè cột Snapshot (Cột G - index 7)
    sheet.getRange(rowIndex, 7).setValue(snapshotJson);
  }
  
  try {
    const appUrl = ScriptApp.getService().getUrl();
    const sysSheet = ss.getSheetByName("SystemConfig");
    const sysData = sysSheet.getDataRange().getValues();
    
    if (newStatus === 'Waiting') {
      const dirRow = sysData.find(r => r[0] === "DIRECTOR_EMAIL");
      const directorEmail = dirRow ? dirRow[1] : "";
      if (directorEmail) {
        const htmlBody = renderEmailBody({
          title: `TỔNG HỢP THU NHẬP THÁNG ${monthStr}`,
          name: "Giám Đốc",
          intro_line: `Bộ phận Kế toán đã hoàn tất bảng công...`,
          message_content: `Hồ sơ đang ở trạng thái: <strong style="color:#ff9500">CHỜ PHÊ DUYỆT (Waiting)</strong>.`,
          closing_note: "",
          action_url: appUrl,
          action_text: "ĐĂNG NHẬP HỆ THỐNG"
        });
        MailApp.sendEmail({ to: directorEmail, subject: `[TRÌNH KÝ] Tổng hợp Thu nhập nhân sự tháng ${monthStr}`, htmlBody: htmlBody });
      }
    }
    
    if (newStatus === 'Approved' || newStatus === 'Pending') {
      const accRow = sysData.find(r => r[0] === "ACCOUNTANT_EMAIL");
      const accEmail = accRow ? accRow[1] : "";
      if (accEmail) {
        const isApproved = (newStatus === 'Approved');
        const resultText = isApproved ? "ĐÃ ĐƯỢC PHÊ DUYỆT ✅" : "YÊU CẦU RÀ SOÁT LẠI ❌";
        const htmlBody = renderEmailBody({
          title: "KẾT QUẢ PHÊ DUYỆT LƯƠNG",
          name: "Bộ phận Kế toán",
          intro_line: `Lãnh đạo đã thực hiện thao tác xem xét bảng lương tháng ${monthStr}.`,
          message_content: `Kết quả: <strong>${resultText}</strong>`,
          closing_note: isApproved ? "Bạn có thể tiến hành chi trả." : "Bảng lương đã được mở khóa.",
          action_url: appUrl,
          action_text: "VÀO HỆ THỐNG"
        });
        MailApp.sendEmail({ to: accEmail, subject: `[KẾT QUẢ] Phê duyệt bảng lương tháng ${monthStr}`, htmlBody: htmlBody });
      }
    }
  } catch (e) {
    console.log(e);
  }
  return { success: true };
}

function getPayslipLogoUrls() {
  return {
    sunnycare: getPayslipLogoSource_(PAYSLIP_LOGO_SUNNYCARE_DRIVE_ID, "SUNNYCARE.png"),
    mettasoul: getPayslipLogoSource_(PAYSLIP_LOGO_METTASOUL_DRIVE_ID, "METTASOUL.png")
  };
}

function getPayslipLogoSource_(fileId, fileName) {
  return getDriveImageDataUri_(fileId, fileName) || buildDriveImageUrl_(fileId);
}

function getDriveImageDataUri_(fileId, fileName) {
  try {
    const blob = DriveApp.getFileById(fileId).getBlob();
    const contentType = blob.getContentType() || "image/png";
    return "data:" + contentType + ";base64," + Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    console.log("Cannot embed payslip logo from Drive (" + fileName + "): " + e);
    return "";
  }
}

function getOrCreatePayslipLogoUrl_(configKey, dataUri, fileName) {
  const ss = getDatabase();
  const configSheet = ss.getSheetByName("SystemConfig");
  const configData = configSheet.getDataRange().getValues();
  const existingRow = configData.find(r => r[0] === configKey);
  let fileId = existingRow ? existingRow[1] : "";

  if (fileId) {
    try {
      DriveApp.getFileById(fileId);
      return buildDriveImageUrl_(fileId);
    } catch (e) {
      fileId = "";
    }
  }

  let targetFolder = null;
  const payslipFolderRow = configData.find(r => r[0] === "FOLDER_PAYSLIPS");
  if (payslipFolderRow && payslipFolderRow[1]) {
    try {
      targetFolder = DriveApp.getFolderById(payslipFolderRow[1]);
    } catch (e) {}
  }
  if (!targetFolder) {
    try {
      const ids = setupDriveFolders();
      targetFolder = DriveApp.getFolderById(ids.payslip);
    } catch (e) {
      targetFolder = DriveApp.getRootFolder();
    }
  }

  const base64 = String(dataUri).split(",").pop();
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), "image/jpeg", fileName);
  const file = targetFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  fileId = file.getId();

  let found = false;
  for (let i = 0; i < configData.length; i++) {
    if (configData[i][0] === configKey) {
      configSheet.getRange(i + 1, 2).setValue(fileId);
      found = true;
      break;
    }
  }
  if (!found) configSheet.appendRow([configKey, fileId]);

  return buildDriveImageUrl_(fileId);
}

function buildDriveImageUrl_(fileId) {
  return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(fileId) + "&sz=w2000";
}

function createPayslipPDF(data) {
  try {
    let html = HtmlService.createTemplateFromFile('payslip');
    
    let mParts = data.month.split('-'); 
    if (mParts.length === 2) {
        html.month = mParts[1] + "/" + mParts[0]; 
    } else {
        html.month = data.month;
    }

    html.email = data.email;
    html.name = data.name;
    html.createdDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
    html.baseSalary = formatCurrencyVN(data.baseSalary);
    html.productIncome = formatCurrencyVN(data.productIncome);
    html.bonus = formatCurrencyVN(data.bonus || 0);
    html.totalIncome = formatCurrencyVN(data.totalIncome);
    html.fixedDed = formatCurrencyVN(data.fixedDed);
    html.incidentDed = formatCurrencyVN(data.incidentDed);
    html.tax = formatCurrencyVN(data.tax);
    html.totalDed = formatCurrencyVN(data.fixedDed + data.incidentDed + data.tax);
    html.netIncome = formatCurrencyVN(data.netIncome);
    html.leaveDays = data.leaveDays;
    
    const blob = html.evaluate().getAs('application/pdf');
    blob.setName("PhieuLuong_" + data.month + "_" + data.name + ".pdf");
    return blob;
  } catch (e) {
    const blob = Utilities.newBlob(`PHIẾU LƯƠNG\nTháng: ${data.month}\nNhân viên: ${data.name}\nThực lĩnh: ${formatCurrencyVN(data.netIncome)}`, 'application/pdf', "PhieuLuong_Simple.pdf");
    return blob;
  }
}

// ======================================================
// 8. LEAVE STATISTICS
// ======================================================

function getLeaveRequests(email, isAdmin) {
  const ss = getDatabase();
  const s = ss.getSheetByName("LeaveRequests");
  if (!s) return [];
  
  const d = s.getDataRange().getValues().slice(1);
  const lt = ss.getSheetByName("LeaveTypes").getDataRange().getValues();
  const u = ss.getSheetByName("Users").getDataRange().getValues();
  
  // Hàm lấy tên User và tên Loại nghỉ
  const gn = (x) => { const f = u.find(r => String(r[0]).toLowerCase().trim() == String(x).toLowerCase().trim()); return f ? f[3] : x };
  const gt = (x) => { const f = lt.find(r => r[0] == x); return f ? f[1] : x };
  
  // [QUAN TRỌNG] Chuẩn hóa email người đang xem để so sánh
  const viewingEmail = String(email).toLowerCase().trim();
  
  let r = [];
  // Duyệt ngược từ dưới lên để thấy đơn mới nhất trước
  for (let i = d.length - 1; i >= 0; i--) {
    const rw = d[i];
    if (!rw[0]) continue;
    
    // Lấy email trong dòng dữ liệu và chuẩn hóa
    const rowEmail = String(rw[1]).toLowerCase().trim();
    
    // So sánh: Nếu là Admin HOẶC Email khớp nhau
    if (isAdmin || rowEmail == viewingEmail) {
      r.push({
        id: rw[0],
        email: rw[1], // Giữ nguyên email gốc để hiển thị
        name: gn(rw[1]),
        start: safeDateStr(rw[2], "dd/MM/yyyy"),
        end: safeDateStr(rw[3], "dd/MM/yyyy"),
        days: rw[4],
        typeName: gt(rw[5]),
        reason: rw[6],
        status: rw[7]
      });
    }
  }
  return r;
}

function getUserLeaveStats(email) {
  const ss = getDatabase();
  const reqSheet = ss.getSheetByName("LeaveRequests");
  const typeSheet = ss.getSheetByName("LeaveTypes");
  
  if (!reqSheet || !typeSheet) return { months: {}, types: {}, totalDays: 0 };

  const leaveTypes = typeSheet.getDataRange().getValues().slice(1);
  const requests = reqSheet.getDataRange().getValues().slice(1);
  
  let typeMap = {};
  leaveTypes.forEach(t => {
    let isPaid = true;
    try {
      const mapping = safeJsonParseServer(t[2]);
      if (mapping && mapping.length > 0) isPaid = false; 
    } catch(e) {}
    typeMap[t[0]] = { name: t[1], isPaid: isPaid };
  });

  let stats = {
    months: {}, 
    types: { "Paid": 0, "Unpaid": 0 },
    totalDays: 0
  };

  requests.forEach(r => {
    if (r[1] === email && r[7] === 'Approved') {
      const days = parseFloat(r[4]) || 0;
      const typeId = r[5];
      let monthStr = safeDateStr(r[2], "MM/yyyy");
      if (!monthStr) return;

      if (!stats.months[monthStr]) stats.months[monthStr] = 0;
      stats.months[monthStr] += days;

      const typeInfo = typeMap[typeId];
      if (typeInfo) {
        if (typeInfo.isPaid) stats.types["Paid"] += days;
        else stats.types["Unpaid"] += days;
      }

      stats.totalDays += days;
    }
  });

  return stats;
}

function getAdminLeaveStats() {
  const ss = getDatabase();
  const reqSheet = ss.getSheetByName("LeaveRequests");
  const userSheet = ss.getSheetByName("Users");
  
  if (!reqSheet || !userSheet) return { absentToday: [], topLeavers: [], typeStructure: {} };

  const requests = reqSheet.getDataRange().getValues().slice(1);
  const users = userSheet.getDataRange().getValues().slice(1);
  
  let userMap = {};
  users.forEach(u => userMap[u[0]] = u[3]);

  const today = new Date();
  today.setHours(0,0,0,0);

  let absentToday = [];
  let leaverCounts = {}; 
  let typeCounts = {}; 

  requests.forEach(r => {
    if (r[7] === 'Approved') {
      const days = parseFloat(r[4]) || 0;
      const email = r[1];
      const typeId = r[5];
      
      const startDate = new Date(r[2]);
      const endDate = new Date(r[3]);
      
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          if (startDate <= today && endDate >= today) {
            absentToday.push({
              name: userMap[email] || email,
              reason: r[6],
              type: typeId 
            });
          }
      }

      if (!leaverCounts[email]) leaverCounts[email] = 0;
      leaverCounts[email] += days;

      if (!typeCounts[typeId]) typeCounts[typeId] = 0;
      typeCounts[typeId] += days;
    }
  });

  let topLeavers = Object.keys(leaverCounts).map(email => ({
    name: userMap[email] || email,
    days: leaverCounts[email]
  })).sort((a,b) => b.days - a.days).slice(0, 5); 

  return {
    absentToday: absentToday,
    topLeavers: topLeavers,
    typeStructure: typeCounts
  };
}

// ======================================================
// 9. LEAVE ACTIONS (XỬ LÝ ĐƠN TỪ & EMAIL)
// ======================================================

function submitLeaveRequest(userEmail, startDate, endDate, days, typeId, reason) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: "Hệ thống bận, vui lòng thử lại." };
  }

  try {
    const ss = getDatabase();
    
    // 1. Kiểm tra khóa sổ (Cắt chuỗi trực tiếp từ "YYYY-MM-DD" -> "YYYY-MM")
    const monthStr = String(startDate).substring(0, 7);
    if (checkIsLocked(monthStr)) {
      return { success: false, message: `Tháng ${monthStr} đã chốt lương. Không thể nộp đơn.` };
    }

    const sheet = ss.getSheetByName("LeaveRequests");
    if (!sheet) return { success: false, message: "Lỗi: Không tìm thấy bảng LeaveRequests" };

    const timestamp = new Date();
    const reqId = "REQ_" + timestamp.getTime();
    
    // 2. Ghi vào sheet
    sheet.appendRow([
      reqId, 
      String(userEmail).toLowerCase().trim(), 
      startDate, 
      endDate, 
      days, 
      typeId, 
      reason, 
      "Pending", 
      timestamp
    ]);

    // 3. Thông báo Admin (Giữ nguyên logic của bạn)
    try {
      const sysSheet = ss.getSheetByName("SystemConfig");
      const dirRow = sysSheet.getDataRange().getValues().find(r => r[0] === "DIRECTOR_EMAIL");
      const directorEmail = dirRow ? dirRow[1] : "";
      if (directorEmail) {
        const htmlBody = renderEmailBody({
          title: "ĐƠN XIN NGHỈ PHÉP MỚI",
          name: "Ban Lãnh Đạo",
          intro_line: `Nhân sự <strong>${userEmail}</strong> vừa gửi đơn xin nghỉ.`,
          message_content: `<div style="text-align:left;">Loại: ${typeId}<br>Thời gian: ${startDate} - ${endDate}<br>Số ngày: ${days}<br>Lý do: ${reason}</div>`,
          closing_note: "Vui lòng duyệt trên hệ thống.",
          action_url: ScriptApp.getService().getUrl(),
          action_text: "XỬ LÝ NGAY"
        });
        MailApp.sendEmail({ to: directorEmail, subject: `[HRM] Đơn nghỉ phép - ${userEmail}`, htmlBody: htmlBody });
      }
    } catch(e) {}

    return { success: true, message: "Đã gửi đơn xin nghỉ thành công!" };

  } catch (e) {
    return { success: false, message: "Lỗi server: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function processLeaveRequest(reqId, status, adminEmail) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
  } catch (e) {
    return { success: false, message: "Hệ thống bận." };
  }

  try {
    const ss = getDatabase();
    const sheet = ss.getSheetByName("LeaveRequests");
    const data = sheet.getDataRange().getValues();
    
    let rowIndex = -1;
    let targetRow = null;

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == reqId) {
        rowIndex = i + 1;
        targetRow = data[i];
        break;
      }
    }

    if (rowIndex === -1) return { success: false, message: "Không tìm thấy đơn này." };

    let startD = new Date(targetRow[2]);
    let monthStr = Utilities.formatDate(startD, Session.getScriptTimeZone(), "yyyy-MM");
    if (checkIsLocked(monthStr)) {
      return { success: false, message: `Tháng ${monthStr} đã khóa sổ. Không thể thay đổi trạng thái đơn.` };
    }

    sheet.getRange(rowIndex, 8).setValue(status);

    try {
      const targetEmail = targetRow[1]; 
      if (targetEmail && targetEmail.includes("@")) {
        
        const isApproved = (status === 'Approved');
        const statusText = isApproved ? "ĐÃ ĐƯỢC PHÊ DUYỆT ✅" : "ĐÃ BỊ TỪ CHỐI ❌";
        const statusColor = isApproved ? "#198754" : "#dc3545"; 
        const appUrl = ScriptApp.getService().getUrl();

        const htmlBody = renderEmailBody({
          title: "KẾT QUẢ ĐƠN NGHỈ PHÉP",
          name: "Bạn",
          intro_line: `Đơn xin nghỉ phép của bạn đã được Lãnh đạo xem xét.`,
          message_content: `
            <div style="text-align:center; padding: 20px; background-color: #fff; border: 1px solid #eee; border-radius: 8px;">
              <div style="font-size: 14px; color: #777; margin-bottom: 5px;">Kết quả xử lý:</div>
              <div style="color: ${statusColor}; font-size: 20px; font-weight: 800;">${statusText}</div>
              <div style="margin-top: 10px; font-size: 13px;">
                 Thời gian: ${safeDateStr(targetRow[2], "dd/MM")} - ${safeDateStr(targetRow[3], "dd/MM")} (${targetRow[4]} ngày)
              </div>
            </div>
            <p style="margin-top: 15px; font-size: 12px; color: #666;">
              * Trạng thái này đã được cập nhật tự động vào bảng công và bảng lương của bạn.
            </p>
          `,
          closing_note: "",
          action_url: appUrl,
          action_text: "KIỂM TRA BẢNG CÔNG"
        });

        MailApp.sendEmail({
          to: targetEmail,
          subject: `[TB] Kết quả duyệt đơn nghỉ phép - ${statusText}`,
          htmlBody: htmlBody
        });
      }
    } catch (mailErr) {
      console.log("Lỗi gửi mail nhân viên: " + mailErr.toString());
    }

    return { success: true, message: "Đã xử lý đơn thành công!" };

  } catch (e) {
    return { success: false, message: "Lỗi: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}
// ======================================================
// 10. TỰ ĐỘNG CẢNH BÁO HỢP ĐỒNG
// ======================================================

function checkContractExpiration() {
  const ss = getDatabase();
  const userSheet = ss.getSheetByName("Users");
  const users = userSheet.getDataRange().getValues().slice(1);
  const sysConfig = ss.getSheetByName("SystemConfig").getDataRange().getValues();
  
  // Lấy email Admin (Hoặc HR) để gửi báo cáo
  const adminRow = sysConfig.find(r => r[0] === "DIRECTOR_EMAIL"); // Hoặc ACCOUNTANT_EMAIL tùy bạn
  const adminEmail = adminRow ? adminRow[1] : "";
  
  if (!adminEmail) return; // Không có email nhận thì thôi
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  let expiringUsers = [];
  
  users.forEach(u => {
    const expireDateStr = u[11]; // Cột L: ContractExpire
    if (expireDateStr) {
      const expDate = new Date(expireDateStr);
      if (!isNaN(expDate.getTime())) {
        // Tính khoảng cách ngày
        const diffTime = expDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        // Logic: Báo trước đúng 10 ngày, hoặc quá hạn
        if (diffDays === 10 || diffDays === 0) {
           expiringUsers.push({
             name: u[3],
             code: u[9], // StaffCode
             date: safeDateStr(expDate, "dd/MM/yyyy"),
             daysLeft: diffDays
           });
        }
      }
    }
  });
  
  if (expiringUsers.length > 0) {
    let htmlContent = "<h3>DANH SÁCH HỢP ĐỒNG SẮP HẾT HẠN / ĐÁO HẠN</h3><ul>";
    expiringUsers.forEach(u => {
       const status = u.daysLeft === 0 ? "HẾT HẠN HÔM NAY" : `Còn ${u.daysLeft} ngày`;
       htmlContent += `<li><strong>${u.name}</strong> (${u.code}): ${u.date} - <span style="color:red">${status}</span></li>`;
    });
    htmlContent += "</ul><p>Vui lòng kiểm tra và thực hiện gia hạn hoặc thanh lý.</p>";
    
    MailApp.sendEmail({
      to: adminEmail,
      subject: "[CẢNH BÁO] Hợp đồng Nhân sự sắp hết hạn",
      htmlBody: htmlContent
    });
  }
}

function setupContractTrigger() {
  // Xóa trigger cũ để tránh trùng
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkContractExpiration') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // Tạo trigger chạy 7h sáng hàng ngày
  ScriptApp.newTrigger('checkContractExpiration')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();
}
// ======================================================
// 11. HỆ THỐNG THƯỞNG NÓNG (GAMIFICATION BONUS)
// ======================================================

/**
 * Hàm 1: Admin tặng thưởng
 */
function adminGiveBonus(targetEmail, amount, reason) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("Bonuses");
  const currentUser = Session.getActiveUser().getEmail();
  
  try {
    const id = "BNS_" + new Date().getTime();
    const dateStr = safeDateStr(new Date(), "yyyy-MM-dd");
    
    // [QUAN TRỌNG] Lưu email dưới dạng chữ thường để đồng nhất
    const savedEmail = String(targetEmail).toLowerCase().trim();
    
    sheet.appendRow([id, savedEmail, amount, reason, dateStr, currentUser, false]);
    return { success: true, message: "Đã gửi thưởng thành công!" };
  } catch (e) {
    return { success: false, message: "Lỗi: " + e.toString() };
  }
}

/**
 * Hàm 2: Nhân viên kiểm tra xem có quà chưa mở không?
 * (Gọi hàm này mỗi khi vào Dashboard)
 */
/**
 * Hàm 2: Nhân viên kiểm tra xem có quà chưa mở không?
 * [ĐÃ SỬA] Nhận email từ Client gửi lên (chính xác 100% với người đang đăng nhập)
 */
function checkMyBonuses(clientEmail) {
  // Ưu tiên lấy email từ Client gửi lên. Nếu không có mới dùng Session (dự phòng)
  const rawEmail = clientEmail || Session.getActiveUser().getEmail();
  const userEmail = String(rawEmail).toLowerCase().trim();
  
  const ss = getDatabase();
  const sheet = ss.getSheetByName("Bonuses");
  const data = sheet.getDataRange().getValues();
  
  let gifts = [];
  
  for (let i = data.length - 1; i >= 1; i--) {
    const r = data[i];
    const rowEmail = String(r[1]).toLowerCase().trim();
    const isRead = r[6]; 
    
    // Logic kiểm tra chưa đọc
    const isUnread = (isRead === false || isRead === "FALSE" || isRead === "" || isRead === "false");
    
    if (rowEmail === userEmail && isUnread) {
      gifts.push({
        id: r[0],
        amount: r[2],
        reason: r[3],
        sender: r[5]
      });
    }
  }
  return gifts;
}

/**
 * Hàm 4: Tính tổng tiền thưởng trong tháng
 * [ĐÃ SỬA] So sánh email không phân biệt hoa thường
 */

/**
 * Hàm 3: Đánh dấu đã mở quà (để không hiện lại lần sau)
 */
function markBonusAsRead(bonusId) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("Bonuses");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(bonusId)) {
      sheet.getRange(i + 1, 7).setValue(true); // Cột G (index 7) là IsRead
      return { success: true };
    }
  }
  return { success: false };
}

/**
 * Hàm 4: Tính tổng tiền thưởng trong tháng để cộng vào lương
 * (Dùng cho hàm tính lương sau này)
 */
function getMonthlyBonusTotal(email, monthStr) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("Bonuses");
  const data = sheet.getDataRange().getValues();
  
  // [QUAN TRỌNG] Chuẩn hóa email đầu vào
  const targetEmail = String(email).toLowerCase().trim();
  
  let totalBonus = 0;
  
  for (let i = 1; i < data.length; i++) {
    // So sánh email chuẩn hóa
    const rowEmail = String(data[i][1]).toLowerCase().trim();
    if (rowEmail !== targetEmail) continue;
    
    // Kiểm tra tháng (Cắt chuỗi yyyy-MM)
    let bDate = data[i][4];
    if (bDate instanceof Date) bDate = safeDateStr(bDate, "yyyy-MM-dd");
    else bDate = String(bDate);
    
    if (bDate.startsWith(monthStr)) {
      totalBonus += Number(data[i][2] || 0);
    }
  }
  
  return totalBonus;
}
// ======================================================
// 12. HÀM PHỤ TRỢ CHO BÁO CÁO (CHARTS)
// ======================================================

/**
 * Tính toán phân bổ chi phí theo Nhóm việc và Công việc
 * Dùng để vẽ biểu đồ tròn và biểu đồ cột trong Báo cáo
 */
function getCompanyCostAnalysis(monthStr) {
  const ss = getDatabase();
  const logsSheet = ss.getSheetByName("WorkLogs");
  const taskGroupsSheet = ss.getSheetByName("TaskGroups");
  const tasksSheet = ss.getSheetByName("Tasks");
  
  const logsData = logsSheet.getDataRange().getValues();
  const groupData = taskGroupsSheet ? taskGroupsSheet.getDataRange().getValues() : [];
  const taskData = tasksSheet ? tasksSheet.getDataRange().getValues() : [];
  
  // 1. Tạo Map để tra cứu nhanh tên Nhóm và Tên Việc
  let groupMap = {}; // ID -> Tên Nhóm
  for(let i=1; i<groupData.length; i++) groupMap[groupData[i][0]] = groupData[i][1];
  
  let taskNameMap = {}; // ID Task -> Tên Task
  let taskGroupMap = {}; // ID Task -> ID Group
  for(let i=1; i<taskData.length; i++) {
    taskNameMap[taskData[i][0]] = taskData[i][2]; // Cột 2 là tên việc
    taskGroupMap[taskData[i][0]] = taskData[i][1]; // Cột 1 là ID nhóm
  }
  
  let byGroup = {};
  let byTask = {};
  
  // 2. Duyệt qua log làm việc để cộng dồn tiền
  for (let i = 1; i < logsData.length; i++) {
    const row = logsData[i];
    if (row[9] === "Deleted") continue; // Bỏ qua dòng đã xóa
    
    // Kiểm tra tháng (Cột 8 là ngày làm việc)
    let dStr = safeDateStr(row[8], "yyyy-MM");
    
    if (dStr === monthStr) {
      const money = parseFloat(row[6]) || 0; // Cột 6 là thành tiền
      const taskId = row[4]; // Cột 4 là ID công việc
      
      // Cộng theo Công việc
      const tName = taskNameMap[taskId] || "Không xác định";
      if (!byTask[tName]) byTask[tName] = 0;
      byTask[tName] += money;
      
      // Cộng theo Nhóm
      const gId = taskGroupMap[taskId];
      const gName = groupMap[gId] || "Khác";
      if (!byGroup[gName]) byGroup[gName] = 0;
      byGroup[gName] += money;
    }
  }
  
  return { byGroup, byTask };
}
// ======================================================
// 13. TÍNH NĂNG DUYỆT LƯƠNG TỪNG NGƯỜI (INDIVIDUAL APPROVAL)
// ======================================================

function approveIndividualUser(monthStr, targetEmail) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("PayrollStatus");
  const data = sheet.getDataRange().getValues();
  
  let rowIndex = -1;
  let approvedList = [];
  
  // 1. Tìm dòng của tháng hiện tại
  for (let i = 1; i < data.length; i++) {
    let rStr = safeDateStr(data[i][0], "yyyy-MM");
    if (!rStr) rStr = String(data[i][0]);
    rStr = rStr.replace("'", "");
    
    if (rStr === monthStr) {
      rowIndex = i + 1;
      // Cột H (Index 7) dùng để lưu danh sách duyệt riêng
      // Cấu trúc bảng: Month(0), Status(1), AppBy(2), AppAt(3), Paid(4), Note(5), Snapshot(6), [INDIVIDUAL_APPROVED](7)
      if (data[i].length > 7 && data[i][7]) {
        approvedList = safeJsonParseServer(data[i][7]);
      }
      break;
    }
  }
  
  // 2. Xử lý lưu
  if (rowIndex === -1) {
    return { success: false, message: "Tháng này chưa được Chốt sổ (Pending). Vui lòng Chốt trước khi Duyệt." };
  }
  
  if (!approvedList.includes(targetEmail)) {
    approvedList.push(targetEmail);
    // Lưu vào cột H (Cột số 8)
    sheet.getRange(rowIndex, 8).setValue(JSON.stringify(approvedList));
  }
  
  return { success: true, message: `Đã duyệt lương cho: ${targetEmail}` };
}
// ======================================================
// 14. TÍNH NĂNG TẠM ỨNG LƯƠNG (SALARY ADVANCE)
// ======================================================

// [CẬP NHẬT] Hàm nhận thêm tham số dateStr
function saveSalaryAdvance(targetEmail, amount, note, dateStr) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("IncurredDeductions"); 
  
  // Xử lý ngày: Nếu Client gửi lên thì dùng, không thì lấy hôm nay
  let recordDate;
  if (dateStr) {
      recordDate = new Date(dateStr);
  } else {
      recordDate = new Date();
  }
  
  // Kiểm tra khóa sổ theo tháng của NGÀY ỨNG (không phải ngày hiện tại)
  const monthStr = Utilities.formatDate(recordDate, Session.getScriptTimeZone(), "yyyy-MM");
  if (checkIsLocked(monthStr)) {
    return { success: false, message: `Tháng ${monthStr} đã khóa sổ, không thể chèn phiếu ứng vào tháng cũ.` };
  }

  try {
    const id = "ADV_" + new Date().getTime();
    const saveDateStr = Utilities.formatDate(recordDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    // Ghi vào bảng: ... Cột F là Ngày (index 5)
    sheet.appendRow([
      id, 
      targetEmail, 
      "TẠM ỨNG LƯƠNG", 
      amount, 
      note, 
      saveDateStr, // <--- Lưu ngày ứng cụ thể
      "Advance" 
    ]);
    
    return { success: true, message: "Đã tạo phiếu ứng lương thành công!" };
  } catch (e) {
    return { success: false, message: "Lỗi: " + e.toString() };
  }
}
// ==========================================
// HÀM MỚI: DÀNH RIÊNG CHO MODAL SỬA CÔNG CỦA ADMIN
// ==========================================
function updateWorkLog(logId, quantity, startTime, endTime, adminNote) {
  const ss = getDatabase();
  const logSheet = ss.getSheetByName("WorkLogs");
  const taskSheet = ss.getSheetByName("Tasks");
  
  // 1. Tìm dòng Log cần sửa
  const logData = logSheet.getDataRange().getValues();
  const rowIndex = logData.findIndex(r => String(r[0]) === String(logId));
  
  if (rowIndex === -1) {
    return { success: false, message: "Không tìm thấy dữ liệu chấm công này!" };
  }
  
  const rowNum = rowIndex + 1;
  const taskId = logData[rowIndex][2]; // Cột C (Index 2) là TaskID
  
  // 2. TÌM ĐƠN GIÁ (RATE) - LOGIC CẢI TIẾN
  let rate = 0;
  
  // Cách 1: Tìm trong bảng Tasks (Cấu trúc thường là: ID | GroupID | Name | Unit | Rate | ...)
  const taskData = taskSheet.getDataRange().getValues();
  const taskRow = taskData.find(r => String(r[0]) === String(taskId));
  
  if (taskRow) {
      // Thử lấy Rate ở cột Index 4 (Cột E) - Đây là vị trí phổ biến nhất
      rate = parseFloat(taskRow[4]); 
  }
  
  // Cách 2 (Fallback an toàn): Nếu Cách 1 ra 0 hoặc NaN (do sai cột hoặc task bị đổi)
  // Ta sẽ tính rate dựa trên dữ liệu cũ (Tiền cũ / Số lượng cũ) để bảo toàn đơn giá lịch sử
  if (!rate || isNaN(rate)) {
      const oldMoney = parseFloat(logData[rowIndex][6]) || 0; // Cột G (Tiền)
      const oldQty = parseFloat(logData[rowIndex][5]) || 0;   // Cột F (Số lượng)
      
      if (oldQty !== 0) {
          rate = oldMoney / oldQty;
      } else {
          // Trường hợp bất khả kháng: Gán tạm bằng 0 để tránh lỗi
          rate = 0; 
      }
  }

  // 3. Tính toán lại Tiền & Số lượng mới
  let newQuantity = parseFloat(quantity);
  let newMoney = 0;

  // Nếu là chấm công theo giờ
  if (startTime && endTime) {
     const start = new Date("2000-01-01T" + startTime);
     const end = new Date("2000-01-01T" + endTime);
     let diffMs = end - start;
     if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000; 
     const diffMins = diffMs / 60000;
     
     newQuantity = diffMins; // Lưu số phút
     
     // Nếu rate tính theo giờ thì chia 60, nếu theo phút thì nhân luôn
     // (Logic an toàn: Giả sử rate tương thích với đơn vị tính)
     newMoney = Math.round(newQuantity * rate);
     
     logSheet.getRange(rowNum, 8).setValue(`${startTime} - ${endTime}`);
  } else {
     // Chấm công theo số lượng
     newMoney = Math.round(newQuantity * rate);
     logSheet.getRange(rowNum, 8).setValue(""); 
  }
  
  // 4. GHI DỮ LIỆU
  logSheet.getRange(rowNum, 6).setValue(newQuantity);
  logSheet.getRange(rowNum, 7).setValue(newMoney);
  logSheet.getRange(rowNum, 12).setValue(adminNote || ""); // Cột L - Ghi chú

  return { success: true, message: "Đã cập nhật: " + newQuantity + " (Rate: " + rate + ")" };
}
function sendContractAlertEmail(alertMessage) {
  const ss = getDatabase();
  const sysConfig = ss.getSheetByName("SystemConfig").getDataRange().getValues();
  
  let emails = [];
  
  // Lấy Email Giám đốc
  const dirRow = sysConfig.find(r => r[0] === "DIRECTOR_EMAIL");
  if (dirRow && dirRow[1] && String(dirRow[1]).includes("@")) emails.push(String(dirRow[1]).trim());
  
  // Lấy Email Kế toán
  const accRow = sysConfig.find(r => r[0] === "ACCOUNTANT_EMAIL");
  if (accRow && accRow[1] && String(accRow[1]).includes("@")) emails.push(String(accRow[1]).trim());
  
  // Lọc trùng lặp email
  emails = [...new Set(emails)];
  
  if (emails.length > 0) {
    const subject = "⚠️ [HRM SUNNYCARE] - Cảnh báo Hợp đồng Nhân sự sắp hết hạn";
    
    // ==========================================================
    // THIẾT KẾ GIAO DIỆN EMAIL HTML CHUẨN THƯƠNG HIỆU
    // ==========================================================
    const htmlBody = `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaec; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        
        <div style="background-color: #dc3545; color: #ffffff; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px;">⚠️ Cảnh Báo Hợp Đồng</h2>
        </div>
        
        <div style="padding: 30px 25px;">
            <p style="font-size: 16px; margin-top: 0;">Chào <strong>Ban Giám Đốc / Kế Toán</strong>,</p>
            <p style="font-size: 15px; color: #555555;">Hệ thống HRM Sunnycare xin gửi thông báo tự động về tình trạng hợp đồng của nhân sự:</p>

            <div style="background-color: #fff5f5; border-left: 4px solid #dc3545; padding: 15px 20px; margin: 25px 0; border-radius: 0 6px 6px 0;">
                <p style="margin: 0; color: #b02a37; font-size: 15px; line-height: 1.5; font-weight: bold;">
                    ${alertMessage}
                </p>
            </div>

            <p style="font-size: 15px; color: #555555;">Vui lòng đăng nhập vào hệ thống và truy cập menu <strong>"Quản lý Nhân sự"</strong> để cập nhật hợp đồng kịp thời, nhằm đảm bảo luồng tính lương không bị gián đoạn.</p>

            <div style="text-align: center; margin: 35px 0 20px 0;">
                <a href="#" style="background-color: #198754; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 15px; text-transform: uppercase;">Truy cập HRM Sunnycare</a>
            </div>

            <hr style="border: none; border-top: 1px solid #eeeeee; margin: 25px 0 20px 0;">
            
            <p style="margin: 0; font-size: 15px;">Trân trọng,<br><strong style="color: #198754; font-size: 16px;">Hệ thống Tự động HRM Sunnycare</strong></p>
        </div>
        
        <div style="background-color: #f8f9fa; color: #888888; padding: 15px; text-align: center; font-size: 12px; border-top: 1px solid #eaeaec;">
            Đây là email tự động từ hệ thống quản trị. Vui lòng không trả lời email này.
        </div>
        
    </div>
    `;

    try {
        MailApp.sendEmail({
            to: emails.join(","),
            subject: subject,
            // ĐỔI TỪ 'body' THÀNH 'htmlBody' ĐỂ ĐỌC ĐƯỢC CODE HTML
            htmlBody: htmlBody
        });
    } catch (e) {
        console.error("Lỗi gửi email: " + e.toString());
    }
  }
  return { success: true };
}

/**
 * XỬ LÝ HÌNH ẢNH (AVATAR) - PHIÊN BẢN "ÉP HIỆN" (DIRECT LINK)
 * ---------------------------------------------------------------
 * Chức năng: Upload ảnh -> Set quyền Public -> Lấy Direct Link
 */

function uploadUserAvatar(fileData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); 
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName("SystemConfig");
    
    // 1. Tìm hoặc Tạo folder chứa Avatar
    let folderId = "";
    const configData = configSheet.getDataRange().getValues();
    const row = configData.find(r => r[0] === "FOLDER_AVATARS");
    
    if (row && row[1]) {
      folderId = row[1];
    } else {
      // Logic tìm folder gốc để tạo
      const r_backup = configData.find(r => r[0] === "FOLDER_BACKUPS");
      let rootId = r_backup ? r_backup[1] : ""; 
      
      let parentFolder;
      if(rootId) {
         try { parentFolder = DriveApp.getFolderById(rootId).getParents().next(); } 
         catch(e) { parentFolder = DriveApp.getRootFolder(); }
      } else {
         parentFolder = DriveApp.getRootFolder();
      }
      
      const folders = parentFolder.getFoldersByName("HRM_Avatars");
      let avatarFolder;
      if (folders.hasNext()) {
        avatarFolder = folders.next();
      } else {
        avatarFolder = parentFolder.createFolder("HRM_Avatars");
      }
      folderId = avatarFolder.getId();
      // Set quyền Public cho cả Folder để chắc chắn mọi file bên trong đều xem được
      avatarFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      configSheet.appendRow(["FOLDER_AVATARS", folderId]);
    }
    
    // 2. Xử lý lưu file
    const folder = DriveApp.getFolderById(folderId);
    
    // Đặt tên file có timestamp để tránh trùng
    const fileName = "Ava_" + fileData.userEmail.split('@')[0] + "_" + new Date().getTime() + ".jpg";
    const blob = Utilities.newBlob(Utilities.base64Decode(fileData.data), fileData.mimeType, fileName);
    const file = folder.createFile(blob);
    
    // [QUAN TRỌNG] Set quyền công khai cho file vừa tạo
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // 3. TẠO URL "ÉP HIỆN" (DIRECT LINK)
    // Thay vì dùng getUrl(), ta tự ghép chuỗi theo ID để có link trực tiếp
    const fileId = file.getId();
    
    // Link dạng này sẽ ép trình duyệt tải ảnh về hiển thị ngay lập tức
    const directUrl = "https://drive.google.com/uc?export=view&id=" + fileId;
    
    return { success: true, url: directUrl };

  } catch (e) {
    return { success: false, message: "Lỗi upload ảnh: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}
