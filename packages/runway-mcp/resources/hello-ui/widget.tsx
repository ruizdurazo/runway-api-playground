import React, { useState } from "react"
import { McpUseProvider, useWidget, type WidgetMetadata } from "mcp-use/react"
import { z } from "zod"

export const propSchema = z.object({
  label: z.string().optional(),
})

export type HelloUiProps = z.infer<typeof propSchema>

export const widgetMetadata: WidgetMetadata = {
  description:
    "MCP Apps smoke test: yellow panel + button to verify widget JS runs in the chat iframe.",
  props: propSchema,
  exposeAsTool: false,
  metadata: {
    prefersBorder: true,
    widgetDescription: "Hello UI smoke test for MCP Apps embedding.",
  },
}

const box: React.CSSProperties = {
  padding: 20,
  fontFamily: "system-ui, sans-serif",
  background: "#fff7d6",
  // border: "2px solid #e6a800",
  // borderRadius: 12,
  maxWidth: "100%",
}

const HelloUiWidget: React.FC = () => {
  const { props, isPending } = useWidget<HelloUiProps>()
  const [clicks, setClicks] = useState(0)

  if (isPending) {
    return (
      <McpUseProvider autoSize>
        <div style={box}>Loading hello UI…</div>
      </McpUseProvider>
    )
  }

  return (
    <McpUseProvider autoSize>
      <div style={box}>
        <p style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600 }}>
          MCP Apps UI is alive
        </p>
        <p style={{ margin: "0 0 12px", fontSize: 14 }}>
          {props?.label ?? "If you see this yellow box, the iframe ran React."}
        </p>
        <button
          type="button"
          onClick={() => setClicks((n) => n + 1)}
          style={{
            padding: "10px 16px",
            fontSize: 14,
            borderRadius: 8,
            border: "1px solid #333",
            cursor: "pointer",
            background: "#fff",
          }}
        >
          Clicked {clicks} time{clicks === 1 ? "" : "s"}
        </button>
      </div>
    </McpUseProvider>
  )
}

export default HelloUiWidget
