export const prerender = false;
import type { APIRoute } from "astro";
import { db } from "../../../service/firebase/server";
import { verifyUser } from "../../../middleware/auth";

export const GET: APIRoute = async ({ params, cookies, request }) => {
  const sessionCookie = cookies.get("__session")?.value;
  let userId;
  let isAuthenticated = false;
  let hasRead = false;

  try {
    if (sessionCookie) {
      const decodedCookie = await verifyUser(sessionCookie);
      userId = decodedCookie.uid;
      isAuthenticated = true;

      // Fetch the read status from Firestore
      const readDoc = await db
        .collection("users")
        .doc(userId)
        .collection("read")
        .doc("pages")
        .get();

      if (readDoc.exists) {
        const data = readDoc.data();
        hasRead = Boolean(data?.pages?.[params.slug || ""]);
      }
    }
  } catch (error) {
    console.error("Error verifying session:", error);
  }

  return new Response(
    JSON.stringify({
      isAuthenticated,
      hasRead,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
};

export const POST: APIRoute = async ({ params, cookies, request }) => {
  const slug = params.slug;
  if (!slug) {
    return new Response(JSON.stringify({ error: "Slug is required" }), {
      status: 400,
    });
  }

  const sessionCookie = cookies.get("__session")?.value;
  if (!sessionCookie) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
    });
  }

  let userId;
  try {
    const decodedCookie = await verifyUser(sessionCookie);
    userId = decodedCookie.uid;
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
    });
  }

  try {
    const body = await request.json();
    const isRead = body.isRead === true;

    const readRef = db.collection("users").doc(userId).collection("read").doc("pages");
    
    if (isRead) {
      // Mark as read - Add to the pages map with timestamp (minute precision)
      await readRef.set({
        pages: {
          [slug]: Math.floor(Date.now() / 60000) // Timestamp in minutes
        }
      }, { merge: true });
    } else {
      // Mark as unread - Remove from the pages map
      // We need to get the current document to update it properly
      const doc = await readRef.get();
      
      if (doc.exists) {
        const data = doc.data() || {};
        const pages = data.pages || {};
        
        // Remove the slug
        delete pages[slug];
        
        // Update the document
        await readRef.update({ pages });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        hasRead: isRead,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error updating read status:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to update read status",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};
