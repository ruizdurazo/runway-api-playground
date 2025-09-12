"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

import styles from "./Sonner.module.scss"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      // className={styles.toaster}
      toastOptions={{
        classNames: {
          toast: styles.toast,
          description: styles.toastDescription,
          actionButton: styles.toastActionButton,
          cancelButton: styles.toastCancelButton,
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
