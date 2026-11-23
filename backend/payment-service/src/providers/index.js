const { MockProvider } = require("./mock-provider");
const { SepayProvider } = require("./sepay-provider");

function createProvider(config) {
  const providerName = config.paymentProvider || "mock";

  switch (providerName) {
    case "sepay":
      return new SepayProvider(config);
    case "mock":
    default:
      return new MockProvider(config);
  }
}

module.exports = { createProvider, MockProvider, SepayProvider };
