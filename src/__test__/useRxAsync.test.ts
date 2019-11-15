import { renderHook, act } from '@testing-library/react-hooks';
import { useRxAsync } from '../useRxAsync';

const delay = (ms: number) => new Promise(_ => setTimeout(_, ms));
const request = () => delay(0).then(() => 1);
const errorReqest = () => delay(0).then(() => Promise.reject('error'));

test('typings', async () => {
  const requestWithParam = (ms: number) => Promise.resolve(ms);
  const requestWithoutParam = () => Promise.resolve(1000);
  const requestOptionalParam = (ms = 1000) => Promise.resolve(ms);

  const caseA = renderHook(() => useRxAsync(requestWithParam, { defer: true }));
  const caseB = renderHook(() =>
    useRxAsync(requestWithoutParam, { defer: true })
  );
  const caseC = renderHook(() =>
    useRxAsync(requestOptionalParam, { defer: true })
  );
  const caseD = renderHook(() => useRxAsync(requestWithoutParam));

  act(() => caseA.result.current.run(1000));
  await caseA.waitForNextUpdate();

  act(() => caseB.result.current.run(1000));
  await caseB.waitForNextUpdate();

  act(() => caseC.result.current.run(1000));
  await caseC.waitForNextUpdate();

  act(() => caseD.result.current.run(1000));
  await caseD.waitForNextUpdate();

  act(() => caseB.result.current.run());
  await caseB.waitForNextUpdate();

  act(() => caseC.result.current.run());
  await caseC.waitForNextUpdate();

  act(() => caseD.result.current.run());
  await caseD.waitForNextUpdate();
});

test('basic', async () => {
  const { result, waitForNextUpdate } = renderHook(() => useRxAsync(request));

  expect(result.current.loading).toBe(true);
  expect(result.current.error).toBe(undefined);

  await waitForNextUpdate();

  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBe(undefined);
  expect(result.current.data).toBe(1);
});

test('defer', async () => {
  const { result, waitForNextUpdate } = renderHook(() =>
    useRxAsync(request, { defer: true })
  );

  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBe(undefined);
  expect(result.current.data).toBe(undefined);

  act(() => {
    result.current.run();
  });

  await waitForNextUpdate();

  expect(result.current.data).toBe(1);
});

test('cancellation', async () => {
  const { result, waitForNextUpdate } = renderHook(() => useRxAsync(request));

  expect(result.current.data).toBe(undefined);

  act(() => {
    result.current.cancel();
  });

  expect(result.current.data).toBe(undefined);

  act(() => {
    result.current.run();
  });

  await waitForNextUpdate();

  expect(result.current.data).toBe(1);

  act(() => {
    result.current.cancel();
  });

  // After cancel data should be same as before
  expect(result.current.data).toBe(1);
});

test('error', async () => {
  const { result, waitForNextUpdate } = renderHook(() =>
    useRxAsync(errorReqest)
  );

  await waitForNextUpdate();

  expect(result.current.error).toBe('error');
  expect(result.current.loading).toBe(false);
  expect(result.current.data).toBe(undefined);
});
