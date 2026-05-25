declare namespace React {
  interface FormEvent<T = Element> extends Event {
    readonly currentTarget: T;
  }
  interface ChangeEvent<T = Element> extends Event {
    readonly currentTarget: T;
  }
  interface MouseEvent<T = Element> extends Event {
    readonly currentTarget: T;
  }
  interface DragEvent<T = Element> extends Event {
    readonly currentTarget: T;
  }
}
