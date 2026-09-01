// Drawer state for the mobile sidebar, shared between the layout and AppNavbar.
export function useSidebar() {
    const isOpen = useState('sidebar-open', () => false);

    return {
        isOpen,
        open: () => isOpen.value = true,
        close: () => isOpen.value = false,
        toggle: () => isOpen.value = !isOpen.value,
    };
}
