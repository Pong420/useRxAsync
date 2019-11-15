import { renderHook, act } from '@testing-library/react-hooks';
import { useRxAsync } from '../useRxAsync';
import { useCallback, useState } from 'react';

const request = () => Promise.resolve(1);
const requestWithParam = (ms: number) => Promise.resolve(ms);
const requestWithoutParam = () => Promise.resolve(1000);
const requestOptionalParam = (ms = 1000) => Promise.resolve(ms);
const errorReqest = () => Promise.reject('error');

test('typings', async () => {
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
  function useTest() {
    const [page, setPage] = useState(0);
    const request = useCallback(() => requestWithParam(page), [page]);
    const next = useCallback(() => setPage(page => page + 1), []);
    const { data, ...reset } = useRxAsync(request);
    return { data, next, ...reset };
  }

  const { result, waitForNextUpdate } = renderHook(() => useTest());

  expect(result.current.loading).toBe(true);
  expect(result.current.error).toBe(undefined);

  await waitForNextUpdate();

  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBe(undefined);
  expect(result.current.data).toBe(0);

  act(() => result.current.next());

  expect(result.current.loading).toBe(true);

  await waitForNextUpdate();

  expect(result.current.loading).toBe(false);
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

  expect(result.current.loading).toBe(false);
  expect(result.current.data).toBe(undefined);

  act(() => {
    result.current.run();
  });

  expect(result.current.loading).toBe(true);

  await waitForNextUpdate();

  expect(result.current.data).toBe(1);

  act(() => {
    result.current.run();
    result.current.cancel();
  });

  // After request cancelled, data should be same as before
  expect(result.current.loading).toBe(false);
  expect(result.current.data).toBe(1);
});

test('reset', async () => {
  const { result } = renderHook(() => useRxAsync(request, { initialValue: 0 }));

  act(() => {
    result.current.reset();
  });

  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBe(undefined);
  expect(result.current.data).toBe(0);
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
