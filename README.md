## useRxAsync

Fetch data with react hooks and rxjs. Inspired by [react-async](https://github.com/async-library/react-async)

```js
const state = useRxAsync(asyncFn, options?);
```

## State

| name    | description                                                                              |
| ------- | ---------------------------------------------------------------------------------------- |
| data    | The value return from asyncFn                                                            |
| loading | boolean                                                                                  |
| error   | any, depends on your asyncFn                                                             |
| cancel  | Skip the new value return from your `asyncFn`. This will not "cancel" your api `asyncFn` |
| reset   | reset data, loading, error to initialValue                                               |

## AsyncFn

A function that return `PromiseLike` or `Observable`. For examples,

```ts
const delay = (ms: number) => new Promise(_ => setTimeout(_, ms));
const asyncFn = () => delay(1000).then(() => 'Hello world');
const asyncFnRx = (result: string) => timer(1000).pipe(map(() => result));
```

## Options

| option       | description                                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| initialValue | Set the initial value of your `asyncFn`                                                                                                        |
| defer        | By default, your `asyncFn` will be call at initial and it changed. if you set `defer` to true, it will only run when you call the `run` mehtod |
| pipe         | rxjs pipe, transform the result or some else                                                                                                   |
| onSuccess    | callback when `asyncFn` success                                                                                                                |
| onFaulure    | callback when `asyncFn` failure                                                                                                                |

## Recipes

```ts
const delay = (ms: number) => new Promise(_ => setTimeout(_, ms));
```

### Basic

```js
import { useRxAsync } from 'use-rx-async';

function Component() {
  const { data, loading, error, cancel, reset } = useRxAsync(asyncFn);

  if (loading) {
    return 'loading...';
  }

  if (error) {
    return 'error!';
  }

  return data;
}
```

### AsyncFn with dynamic parameters

```ts
const asyncFnWithParam = (result: string) => delay(1000).then(() => result);

// wrap your default asyncFn with useCallback
function useHooks() {
  const [result, setResult] = useState<string>();
  const asyncFn = useCallback(() => {
    return typeof result === 'string'
      ? asyncFnWithParam(result)
      : Promise.reject();
  }, [result]);
  const { loading, data } = useRxAsync(asyncFn);

  useEffect(() => {
    setResult('Hello world');
  }, []);
}

// Or set `defer` to true, if the asyncFn has parameters, you cannot set defer to false / undefined.
function useHooks() {
  const { run } = useRxAsync(asyncFnWithParam, { defer: true });
  useEffect(() => {
    run('Hello World');
  }, [run]);
}
```

### With initial value

```ts
// if you are using axios, and you have an api return a string array
const apiRequest = () => axios.get<string[]>('/some-api');

// you could wrap your api request first
const asyncFn = () => apiRequest().then(res => res.data);

function useHooks() {
  const { data } = useRxAsync(asyncFn, { initialValue: [] });

  return (
    <ul>
      {data.map((str, index) => (
        <li key={index}>{str}</li>
      ))}
    </ul>
  );
}
```

### Pipe

```ts
const double = (ob: Observable<number>) => ob.pipe(map(v => v * 2));
const asyncFn = (result: number) => delay(1000).then(() => result);

function useHooks() {
  // pipe cannot apply to initialValue. `data` will be `10` at initial, util next asyncFn success
  const { loading, data, run } = useRxAsync(asyncFn, {
    defer: true,
    initialValue: 10,
    pipe: double,
  });
}
```

### Caching

if you are axios user, you could use [kuitos/axios-extensions](https://github.com/kuitos/axios-extensions)
