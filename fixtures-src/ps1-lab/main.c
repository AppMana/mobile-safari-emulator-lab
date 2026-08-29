/*
 * Mobile Safari PS1 Lab fixture.
 * Adapted from the PSn00bSDK v0.24 beginner/hello example.
 * Original (C) 2020-2023 Lameguy64, spicyjpeg; MPL-2.0.
 * Modifications (C) 2026 AppMana contributors; MPL-2.0.
 */

#include <assert.h>
#include <stddef.h>
#include <stdint.h>
#include <psxgpu.h>

#define OT_LENGTH 16
#define BUFFER_LENGTH 8192
#define SCREEN_XRES 320
#define SCREEN_YRES 240

typedef struct {
    DISPENV disp_env;
    DRAWENV draw_env;
    uint32_t ot[OT_LENGTH];
    uint8_t buffer[BUFFER_LENGTH];
} RenderBuffer;

typedef struct {
    RenderBuffer buffers[2];
    uint8_t *next_packet;
    int active_buffer;
} RenderContext;

static void setup_context(RenderContext *ctx) {
    SetDefDrawEnv(&(ctx->buffers[0].draw_env), 0, 0, SCREEN_XRES, SCREEN_YRES);
    SetDefDispEnv(&(ctx->buffers[0].disp_env), 0, 0, SCREEN_XRES, SCREEN_YRES);
    SetDefDrawEnv(&(ctx->buffers[1].draw_env), 0, SCREEN_YRES, SCREEN_XRES, SCREEN_YRES);
    SetDefDispEnv(&(ctx->buffers[1].disp_env), 0, SCREEN_YRES, SCREEN_XRES, SCREEN_YRES);

    setRGB0(&(ctx->buffers[0].draw_env), 5, 9, 28);
    setRGB0(&(ctx->buffers[1].draw_env), 5, 9, 28);
    ctx->buffers[0].draw_env.isbg = 1;
    ctx->buffers[1].draw_env.isbg = 1;

    ctx->active_buffer = 0;
    ctx->next_packet = ctx->buffers[0].buffer;
    ClearOTagR(ctx->buffers[0].ot, OT_LENGTH);
    SetDispMask(1);
}

static void flip_buffers(RenderContext *ctx) {
    DrawSync(0);
    VSync(0);

    RenderBuffer *draw_buffer = &(ctx->buffers[ctx->active_buffer]);
    RenderBuffer *display_buffer = &(ctx->buffers[ctx->active_buffer ^ 1]);
    PutDispEnv(&(display_buffer->disp_env));
    DrawOTagEnv(&(draw_buffer->ot[OT_LENGTH - 1]), &(draw_buffer->draw_env));

    ctx->active_buffer ^= 1;
    ctx->next_packet = display_buffer->buffer;
    ClearOTagR(display_buffer->ot, OT_LENGTH);
}

static void *new_primitive(RenderContext *ctx, int z, size_t size) {
    RenderBuffer *buffer = &(ctx->buffers[ctx->active_buffer]);
    uint8_t *primitive = ctx->next_packet;
    addPrim(&(buffer->ot[z]), primitive);
    ctx->next_packet += size;
    assert(ctx->next_packet <= &(buffer->buffer[BUFFER_LENGTH]));
    return primitive;
}

static void draw_text(RenderContext *ctx, int x, int y, const char *text) {
    RenderBuffer *buffer = &(ctx->buffers[ctx->active_buffer]);
    ctx->next_packet = (uint8_t *) FntSort(&(buffer->ot[0]), ctx->next_packet, x, y, text);
    assert(ctx->next_packet <= &(buffer->buffer[BUFFER_LENGTH]));
}

int main(void) {
    ResetGraph(0);
    FntLoad(960, 0);

    RenderContext context;
    setup_context(&context);
    int x = 0;
    int y = 80;
    int dx = 2;
    int dy = 1;

    for (;;) {
        if (x < 0 || x > SCREEN_XRES - 48) dx = -dx;
        if (y < 48 || y > SCREEN_YRES - 48) dy = -dy;
        x += dx;
        y += dy;

        TILE *tile = (TILE *) new_primitive(&context, 1, sizeof(TILE));
        setTile(tile);
        setXY0(tile, x, y);
        setWH(tile, 48, 48);
        setRGB0(tile, 113, 209, 255);

        draw_text(&context, 12, 16, "MOBILE SAFARI / PS1\nLOCAL WASM GPU OUTPUT");
        flip_buffers(&context);
    }
}
