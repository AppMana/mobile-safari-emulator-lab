bits 16
org 0x100

    cld
    mov ax, 0x0003
    int 0x10

    mov ax, 0xb800
    mov es, ax

    xor di, di
    mov ax, 0x1f20
    mov cx, 2000
    rep stosw

    mov si, title
    mov di, (7 * 160) + (29 * 2)
    mov ah, 0x1f
    call print

    mov si, subtitle
    mov di, (9 * 160) + (29 * 2)
    call print

    mov si, hint
    mov di, (18 * 160) + (33 * 2)
    call print

    xor bx, bx

frame:
    mov dx, 0x03da
.wait_retrace_end:
    in al, dx
    test al, 0x08
    jnz .wait_retrace_end
.wait_retrace_start:
    in al, dx
    test al, 0x08
    jz .wait_retrace_start

    mov di, (13 * 160) + (20 * 2)
    mov cx, 40
    mov al, 0xdb
    mov ah, bl
    and ah, 0x07
    add ah, 0x09
.bar:
    stosw
    loop .bar

    inc bl
    in al, 0x60
    cmp al, 0x01
    jne frame

    mov ax, 0x0003
    int 0x10
    ret

print:
    lodsb
    test al, al
    jz .done
    stosw
    jmp print
.done:
    ret

title db "MOBILE SAFARI / DOS", 0
subtitle db "LOCAL WASM VGA OUTPUT", 0
hint db "ESC TO RETURN", 0
