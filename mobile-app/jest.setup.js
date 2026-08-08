// In-memory AsyncStorage mock so the durable upload outbox can be unit-tested
// without a device or native module. `mockStore` keeps a per-test key/value map;
// each test clears it (tests call AsyncStorage.clear() in their own beforeEach).
const mockStore = new Map();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key) => (mockStore.has(key) ? mockStore.get(key) : null)),
    setItem: jest.fn(async (key, value) => {
      mockStore.set(key, value);
    }),
    removeItem: jest.fn(async (key) => {
      mockStore.delete(key);
    }),
    clear: jest.fn(async () => {
      mockStore.clear();
    }),
    getAllKeys: jest.fn(async () => Array.from(mockStore.keys())),
  },
}));


