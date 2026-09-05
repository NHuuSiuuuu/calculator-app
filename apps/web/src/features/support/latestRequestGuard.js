export function createLatestRequestGuard() {
  let latestRequest = 0;

  return {
    begin() {
      latestRequest += 1;
      return latestRequest;
    },
    isCurrent(request) {
      return request === latestRequest;
    },
  };
}
