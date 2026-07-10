import { useSearchStore } from "./FaqSearch"

export function SearchInput(props): any {
    const [store, setStore] = useSearchStore()
    return {
        ...props,
        value: store.query,
        onChange: (e) => setStore({ query: e.target.value }),
    }
}
