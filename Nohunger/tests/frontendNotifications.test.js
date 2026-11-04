const fs = require("fs");
const path = require("path");
const vm = require("vm");

function createElement(initialHtml = "") {
  let html = initialHtml;
  return {
    className: "",
    style: {},
    get innerHTML() {
      return html;
    },
    set innerHTML(value) {
      html = String(value);
    },
    get textContent() {
      return html.replace(/<[^>]*>/g, "").trim();
    },
    set textContent(value) {
      html = String(value);
    },
    get children() {
      return html.includes("<div") ? [{}] : [];
    }
  };
}

function loadNotifications() {
  const notificationsPath = path.join(__dirname, "../public/js/notifications.js");
  const bellButton = createElement();
  const notifyPopup = createElement();
  const notifyContent = createElement();
  const elements = {
    bellBtn: bellButton,
    notifyPopup,
    notifyContent,
    notifBadge: createElement()
  };
  const clickHandlers = {};
  const toasts = [];
  const context = {
    window: {},
    API: "",
    role: "receiver",
    locationValue: "north city",
    notificationCount: 0,
    fetch: jest.fn(),
    getAuthHeaders: () => ({}),
    sessionStorage: { getItem: () => "receiver@example.test" },
    escapeHtml: value => String(value),
    showToast: (...args) => toasts.push(args),
    setClick: (id, handler) => { clickHandlers[id] = handler; },
    document: {
      getElementById: id => elements[id] || null
    },
    console: { error: jest.fn() }
  };

  vm.createContext(context);
  vm.runInContext(fs.readFileSync(notificationsPath, "utf8"), context);
  context.initBellNotifications();
  return { context, elements, clickHandlers, toasts };
}

test("bell displays an empty state for a successful empty response", async () => {
  const { context, clickHandlers, elements } = loadNotifications();
  context.fetch.mockResolvedValue({
    ok: true,
    json: async () => []
  });

  await clickHandlers.bellBtn();

  expect(elements.notifyContent.className).toBe("panel-state empty-state");
  expect(elements.notifyContent.textContent).toBe("No notifications yet");
});

test("bell displays an error state for an HTTP failure", async () => {
  const { context, clickHandlers, elements } = loadNotifications();
  context.fetch.mockResolvedValue({ ok: false, status: 500 });

  await clickHandlers.bellBtn();

  expect(elements.notifyContent.className).toBe("panel-state error-state");
  expect(elements.notifyContent.textContent).toBe("Notifications could not be loaded");
});

test("refresh failure preserves previously rendered notifications", async () => {
  const { context, elements, toasts } = loadNotifications();
  elements.notifyContent.innerHTML = "<div>Existing notification</div>";
  context.fetch.mockResolvedValue({ ok: false, status: 500 });

  await context.refreshNotificationContent(elements.notifyContent);

  expect(elements.notifyContent.innerHTML).toBe("<div>Existing notification</div>");
  expect(toasts).toHaveLength(1);
});

test("refresh failure replaces an empty placeholder with an error state", async () => {
  const { context, elements } = loadNotifications();
  elements.notifyContent.textContent = "No notifications";
  context.fetch.mockRejectedValue(new Error("network unavailable"));

  await context.refreshNotificationContent(elements.notifyContent);

  expect(elements.notifyContent.className).toBe("panel-state error-state");
  expect(elements.notifyContent.textContent).toBe("Notifications could not be loaded");
});

test("refresh displays the empty state when filtering leaves no visible notifications", async () => {
  const { context, elements } = loadNotifications();
  context.fetch.mockResolvedValue({
    ok: true,
    json: async () => [{
      senderEmail: "receiver@example.test",
      fromRole: "donor",
      status: "accepted",
      createdAt: new Date().toISOString()
    }]
  });

  await context.refreshNotificationContent(elements.notifyContent);

  expect(elements.notifyContent.className).toBe("panel-state empty-state");
  expect(elements.notifyContent.textContent).toBe("No notifications yet");
});

test("repeated REST refreshes do not duplicate a live notification", async () => {
  const { context, elements } = loadNotifications();
  context.fetch.mockResolvedValue({
    ok: true,
    json: async () => [{
      senderEmail: "donor@example.test",
      foodItem: "Rice",
      createdAt: new Date().toISOString(),
      message: "Meals available"
    }]
  });

  await context.refreshNotificationContent(elements.notifyContent);
  await context.refreshNotificationContent(elements.notifyContent);

  expect(elements.notifyContent.innerHTML.match(/Meals available/g)).toHaveLength(1);
});

test("a stale REST refresh cannot overwrite a newer socket update", async () => {
  const { context, elements } = loadNotifications();
  let resolveResponse;
  context.fetch.mockReturnValue(new Promise(resolve => {
    resolveResponse = resolve;
  }));
  elements.notifyContent.innerHTML = "<div>New live notification</div>";

  const refresh = context.refreshNotificationContent(elements.notifyContent);
  context.notificationUpdateVersion++;
  resolveResponse({
    ok: true,
    json: async () => [{
      senderEmail: "donor@example.test",
      createdAt: new Date().toISOString(),
      message: "Older REST result"
    }]
  });
  await refresh;

  expect(elements.notifyContent.innerHTML).toBe("<div>New live notification</div>");
});
