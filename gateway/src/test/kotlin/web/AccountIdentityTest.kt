package web

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import tsproto.Identity
import tsproto.MyTsAccount
import tsproto.MyTsIdentities

class AccountIdentityTest {
    @Test fun automaticallyUsesTheNamedIdentityOfTheCurrentAccount() {
        val current = MyTsAccount.Session("synthetic-a", "A")
        val other = MyTsAccount.Session("synthetic-b", "B")
        fun entry(id: String, name: String): MyTsIdentities.Entry {
            val key = Identity.generate(securityLevel = 0)
            return MyTsIdentities.Entry(id, name, "", key.uid, "fixture-uid", key)
        }
        val first = entry("1", "defult")
        assertEquals(first.identity.uid, automaticAccountIdentity(current, current, listOf(first))?.uid)
        assertNull(automaticAccountIdentity(current, other, listOf(first)))
        assertNull(automaticAccountIdentity(null, current, listOf(first)))
        assertNull(automaticAccountIdentity(current, current, emptyList()))
        assertEquals(first.identity.uid, automaticAccountIdentity(current, current, listOf(entry("2", "默认"), first))?.uid)
        assertNull(automaticAccountIdentity(current, current, listOf(entry("2", "默认"))))
        assertNull(automaticAccountIdentity(current, current, listOf(first, entry("3", "defult"))))
    }
}
