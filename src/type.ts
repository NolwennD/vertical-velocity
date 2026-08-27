export type NonEmptyArray<T> = readonly [T, ...T[]];
export type AtLeastTwo<T> = readonly [T, T, ...T[]];

export const mapAtLeastTwo = <T, U>(
  items: AtLeastTwo<T>,
  transform: (item: T, index: number) => U,
): AtLeastTwo<U> => {
  const [first, second, ...rest] = items;

  return [
    transform(first, 0),
    transform(second, 1),
    ...rest.map((item, index) => transform(item, index + 2)),
  ];
};
