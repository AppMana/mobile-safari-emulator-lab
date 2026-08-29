bits 16
org 0x100

    mov ax, 0x0013
    int 0x10
    mov ax, 0xa000
    mov es, ax
    xor bx, bx

frame:
    xor di, di
    mov cx, 64000

pixel:
    mov ax, di
    xor al, ah
    add al, bl
    stosb
    loop pixel

    inc bl
    in al, 0x60
    cmp al, 0x01
    jne frame

    mov ax, 0x0003
    int 0x10
    ret
